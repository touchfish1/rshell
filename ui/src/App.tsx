import { useEffect, useRef, useState } from "react";
import HomePage from "./pages/HomePage";
import TerminalPage from "./pages/TerminalPage";
import TerminalPane from "./components/TerminalPane";
import {
  connectSession,
  createSession,
  deleteSession,
  disconnectSession,
  listSftpDir,
  listSessions,
  onDebugLog,
  onTerminalOutput,
  pullOutput,
  resizeTerminal,
  sendInput,
  updateSession,
} from "./services/bridge";
import type { Session, SessionInput, SftpEntry } from "./services/types";

interface TerminalTab {
  id: string;
  sessionId: string;
  title: string;
}

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [connectedIds, setConnectedIds] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | undefined>();
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [currentPage, setCurrentPage] = useState<"home" | "terminal">("home");
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState<string | null>(null);
  const [sftpEntriesMap, setSftpEntriesMap] = useState<Record<string, SftpEntry[]>>({});
  const [sftpPathMap, setSftpPathMap] = useState<Record<string, string>>({});
  const [sftpLoadingId, setSftpLoadingId] = useState<string | null>(null);
  const writerMapRef = useRef<Map<string, (content: string) => void>>(new Map());
  const tabsRef = useRef<TerminalTab[]>([]);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    void listSessions()
      .then((data) => {
        setSessions(data);
        if (data.length > 0) {
          setSelectedId(data[0].id);
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setError(`加载会话失败: ${message}`);
      });
    const unlistenPromise = onTerminalOutput((payload) => {
      const plain = atob(payload.data);
      console.debug("[frontend][terminal-output]", payload.sessionId, plain.slice(0, 120));
      const relatedTabs = tabsRef.current.filter((tab) => tab.sessionId === payload.sessionId);
      relatedTabs.forEach((tab) => writerMapRef.current.get(tab.id)?.(plain));
    });
    const unlistenDebugPromise = onDebugLog((payload) => {
      const line = `[${new Date().toLocaleTimeString()}] [${payload.stage}] ${payload.sessionId} ${payload.message}`;
      console.debug("[frontend][debug-log]", line);
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
      void unlistenDebugPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    if (connectedIds.length === 0) return;
    const timer = window.setInterval(() => {
      connectedIds.forEach((id) => {
        void pullOutput(id)
          .then((base64) => {
            if (!base64) return;
            const plain = atob(base64);
            const relatedTabs = tabsRef.current.filter((tab) => tab.sessionId === id);
            relatedTabs.forEach((tab) => writerMapRef.current.get(tab.id)?.(plain));
          })
          .catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
            setError(`拉取输出失败: ${message}`);
          });
      });
    }, 10);
    return () => window.clearInterval(timer);
  }, [connectedIds]);

  const create = async (input: SessionInput, secret?: string) => {
    try {
      const session = await createSession(input, secret);
      const next = [...sessions, session];
      setSessions(next);
      setSelectedId(session.id);
      setStatus(`已创建会话: ${session.name}`);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`创建会话失败: ${message}`);
    }
  };

  const connect = async (id?: string) => {
    const sessionId = id ?? selectedId;
    if (!sessionId) return;
    const targetSession = sessions.find((session) => session.id === sessionId);
    const index = tabsRef.current.filter((tab) => tab.sessionId === sessionId).length + 1;
    const tabId = `${sessionId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const tabTitle = `${targetSession?.name ?? sessionId}${index > 1 ? ` (${index})` : ""}`;
    setTabs((prev) => [...prev, { id: tabId, sessionId, title: tabTitle }]);
    setActiveTabId(tabId);
    setCurrentPage("terminal");
    setStatus(`连接中: ${targetSession?.name ?? sessionId}`);
    setError(null);

    const rollbackTab = () => {
      setTabs((prev) => prev.filter((tab) => tab.id !== tabId));
      setActiveTabId((prev) => (prev === tabId ? undefined : prev));
      writerMapRef.current.delete(tabId);
      setSftpEntriesMap((prev) => {
        const next = { ...prev };
        delete next[tabId];
        return next;
      });
      setSftpPathMap((prev) => {
        const next = { ...prev };
        delete next[tabId];
        return next;
      });
    };

    if (connectedIds.includes(sessionId)) {
      setStatus(`已连接: ${targetSession?.name ?? sessionId}`);
      void loadSftp(tabId, sessionId, ".");
      return;
    }
    try {
      await connectSession(sessionId);
      setConnectedIds((prev) => (prev.includes(sessionId) ? prev : [...prev, sessionId]));
      setStatus(`已连接: ${targetSession?.name ?? sessionId}`);
      void loadSftp(tabId, sessionId, ".");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("missing SSH password")) {
        const input = window.prompt("请输入 SSH 密码（将保存到本地配置文件）");
        if (!input) {
          setError("连接失败: 缺少 SSH 密码");
          rollbackTab();
          return;
        }
        try {
          if (targetSession) {
            const sessionInput: SessionInput = {
              name: targetSession.name,
              protocol: targetSession.protocol,
              host: targetSession.host,
              port: targetSession.port,
              username: targetSession.username,
              encoding: targetSession.encoding,
              keepalive_secs: targetSession.keepalive_secs,
            };
            await updateSession(sessionId, sessionInput, input);
          }
          await connectSession(sessionId, input);
          setConnectedIds((prev) => (prev.includes(sessionId) ? prev : [...prev, sessionId]));
          setStatus(`已连接: ${targetSession?.name ?? sessionId}`);
          setError(null);
          void loadSftp(tabId, sessionId, ".");
          return;
        } catch (retryErr) {
          const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
          setError(`连接失败: ${retryMsg}`);
          rollbackTab();
          return;
        }
      }
      setError(`连接失败: ${message}`);
      rollbackTab();
    }
  };

  const disconnect = async (id?: string) => {
    const targetTabId = id ?? activeTabId;
    if (!targetTabId) return;
    const targetTab = tabsRef.current.find((tab) => tab.id === targetTabId);
    if (!targetTab) return;
    try {
      const remainTabsSameSession = tabsRef.current.filter(
        (tab) => tab.sessionId === targetTab.sessionId && tab.id !== targetTab.id
      );
      if (remainTabsSameSession.length === 0 && connectedIds.includes(targetTab.sessionId)) {
        await disconnectSession(targetTab.sessionId);
        setConnectedIds((prev) => prev.filter((sid) => sid !== targetTab.sessionId));
      }
      let nextTabs: TerminalTab[] = [];
      setTabs((prev) => {
        nextTabs = prev.filter((tab) => tab.id !== targetTab.id);
        return nextTabs;
      });
      writerMapRef.current.delete(targetTab.id);
      setSftpEntriesMap((prev) => {
        const next = { ...prev };
        delete next[targetTab.id];
        return next;
      });
      setSftpPathMap((prev) => {
        const next = { ...prev };
        delete next[targetTab.id];
        return next;
      });
      setActiveTabId((prev) => {
        if (prev !== targetTab.id) return prev;
        const remain = nextTabs;
        return remain[remain.length - 1]?.id;
      });
      if (nextTabs.length === 0) {
        setCurrentPage("home");
      }
      setStatus("已断开");
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`断开失败: ${message}`);
    }
  };

  const remove = async (id: string) => {
    try {
      if (connectedIds.includes(id)) {
        await disconnectSession(id);
        setConnectedIds((prev) => prev.filter((sid) => sid !== id));
        setTabs((prev) => prev.filter((tab) => tab.sessionId !== id));
        Array.from(writerMapRef.current.keys()).forEach((key) => {
          if (key.startsWith(`${id}-`)) {
            writerMapRef.current.delete(key);
          }
        });
      }
      await deleteSession(id);
      const next = sessions.filter((s) => s.id !== id);
      setSessions(next);
      if (selectedId === id) {
        setSelectedId(next[0]?.id);
      }
      setStatus("已删除会话");
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`删除失败: ${message}`);
    }
  };

  const closeTab = async (id: string) => {
    await disconnect(id);
  };

  const loadSftp = async (tabId: string, sessionId: string, path?: string) => {
    setSftpLoadingId(tabId);
    try {
      const nextPath = path ?? sftpPathMap[tabId] ?? ".";
      const entries = await listSftpDir(sessionId, nextPath);
      setSftpEntriesMap((prev) => ({ ...prev, [tabId]: entries }));
      setSftpPathMap((prev) => ({ ...prev, [tabId]: nextPath }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`SFTP 列表读取失败: ${message}`);
    } finally {
      setSftpLoadingId((prev) => (prev === tabId ? null : prev));
    }
  };

  useEffect(() => {
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;
    if (!connectedIds.includes(tab.sessionId)) return;
    if (sftpEntriesMap[activeTabId]) return;
    void loadSftp(activeTabId, tab.sessionId);
  }, [activeTabId, connectedIds, sftpEntriesMap, tabs]);

  return (
    <main className="app-shell">
      {currentPage === "home" ? (
        <HomePage
          sessions={sessions}
          selectedId={selectedId}
          connectedIds={connectedIds}
          connected={connectedIds.length > 0}
          error={error}
          status={status}
          onSelect={setSelectedId}
          onCreate={create}
          onDelete={remove}
          onConnect={connect}
        />
      ) : (
        <TerminalPage
          sessions={sessions}
          activeTabId={activeTabId}
          tabs={tabs}
          connectedIds={connectedIds}
          error={error}
          status={status}
          sftpEntries={activeTabId ? sftpEntriesMap[activeTabId] ?? [] : []}
          sftpPath={activeTabId ? sftpPathMap[activeTabId] ?? "." : "."}
          sftpLoading={Boolean(activeTabId && sftpLoadingId === activeTabId)}
          onOpenSession={(id) => void connect(id)}
          onSwitchTab={setActiveTabId}
          onCloseTab={(id) => void closeTab(id)}
          onSftpOpenDir={(path) => {
            if (activeTabId) {
              const tab = tabs.find((t) => t.id === activeTabId);
              if (tab) {
                void loadSftp(activeTabId, tab.sessionId, path);
              }
            }
          }}
          onSftpUp={() => {
            if (!activeTabId) return;
            const tab = tabs.find((t) => t.id === activeTabId);
            if (!tab) return;
            const current = sftpPathMap[activeTabId] ?? ".";
            if (current === "." || current === "/") return;
            const normalized = current.replace(/\/+$/, "");
            const idx = normalized.lastIndexOf("/");
            const parent = idx <= 0 ? "/" : normalized.slice(0, idx);
            void loadSftp(activeTabId, tab.sessionId, parent);
          }}
          onBackToHome={() => setCurrentPage("home")}
          onDisconnect={(id) => void disconnect(id)}
          terminals={tabs.map((tab) => ({
            id: tab.id,
            node: (
              <TerminalPane
                isActive={activeTabId === tab.id}
                connected={connectedIds.includes(tab.sessionId) && activeTabId === tab.id}
                registerWriter={(nextWriter) => {
                  writerMapRef.current.set(tab.id, nextWriter);
                }}
                onInput={(text) => {
                  if (connectedIds.includes(tab.sessionId) && activeTabId === tab.id) {
                    void sendInput(tab.sessionId, text).catch((err) => {
                      const message = err instanceof Error ? err.message : String(err);
                      setError(`发送失败: ${message}`);
                    });
                  }
                }}
                onResize={(cols, rows) => {
                  if (connectedIds.includes(tab.sessionId) && activeTabId === tab.id) {
                    void resizeTerminal(tab.sessionId, cols, rows).catch((err) => {
                      const message = err instanceof Error ? err.message : String(err);
                      setError(`调整终端尺寸失败: ${message}`);
                    });
                  }
                }}
              />
            ),
          }))}
        />
      )}
    </main>
  );
}
