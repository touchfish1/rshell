import { useEffect, useMemo, useRef, useState } from "react";
import HomePage from "./pages/HomePage";
import TerminalPage from "./pages/TerminalPage";
import TerminalPane from "./components/TerminalPane";
import {
  connectSession,
  createSession,
  deleteSession,
  disconnectSession,
  listSessions,
  onDebugLog,
  onTerminalOutput,
  pullOutput,
  resizeTerminal,
  sendInput,
  updateSession,
} from "./services/bridge";
import type { Session, SessionInput } from "./services/types";

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [connectedIds, setConnectedIds] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | undefined>();
  const [tabs, setTabs] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<"home" | "terminal">("home");
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState<string | null>(null);
  const writerMapRef = useRef<Map<string, (content: string) => void>>(new Map());

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeTabId),
    [sessions, activeTabId]
  );

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
      writerMapRef.current.get(payload.sessionId)?.(plain);
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
            writerMapRef.current.get(id)?.(plain);
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
    const targetId = id ?? selectedId;
    if (!targetId) {
      return;
    }
    const targetSession = sessions.find((session) => session.id === targetId);
    if (connectedIds.includes(targetId)) {
      setActiveTabId(targetId);
      setCurrentPage("terminal");
      setStatus(`已连接: ${targetSession?.name ?? targetId}`);
      setError(null);
      return;
    }
    try {
      await connectSession(targetId);
      setConnectedIds((prev) => (prev.includes(targetId) ? prev : [...prev, targetId]));
      setTabs((prev) => (prev.includes(targetId) ? prev : [...prev, targetId]));
      setActiveTabId(targetId);
      setCurrentPage("terminal");
      setStatus(`已连接: ${targetSession?.name ?? targetId}`);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("missing SSH password")) {
        const input = window.prompt("请输入 SSH 密码（将保存到本地配置文件）");
        if (!input) {
          setError("连接失败: 缺少 SSH 密码");
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
            await updateSession(targetId, sessionInput, input);
          }
          await connectSession(targetId, input);
          setConnectedIds((prev) => (prev.includes(targetId) ? prev : [...prev, targetId]));
          setTabs((prev) => (prev.includes(targetId) ? prev : [...prev, targetId]));
          setActiveTabId(targetId);
          setCurrentPage("terminal");
          setStatus(`已连接: ${targetSession?.name ?? targetId}`);
          setError(null);
          return;
        } catch (retryErr) {
          const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
          setError(`连接失败: ${retryMsg}`);
          return;
        }
      }
      setError(`连接失败: ${message}`);
    }
  };

  const disconnect = async (id?: string) => {
    const targetId = id ?? activeTabId;
    if (!targetId) {
      return;
    }
    try {
      await disconnectSession(targetId);
      setConnectedIds((prev) => prev.filter((sid) => sid !== targetId));
      let nextTabs: string[] = [];
      setTabs((prev) => {
        nextTabs = prev.filter((sid) => sid !== targetId);
        return nextTabs;
      });
      writerMapRef.current.delete(targetId);
      setActiveTabId((prev) => {
        if (prev !== targetId) return prev;
        const remain = nextTabs;
        return remain[remain.length - 1];
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
        setTabs((prev) => prev.filter((sid) => sid !== id));
        writerMapRef.current.delete(id);
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
    if (connectedIds.includes(id)) {
      await disconnect(id);
      return;
    }
    setTabs((prev) => prev.filter((sid) => sid !== id));
    setActiveTabId((prev) => (prev === id ? undefined : prev));
  };

  const sftpFiles = useMemo(() => {
    if (!activeSession) return [];
    return [
      ".",
      "..",
      "home/",
      "var/",
      "etc/",
      "tmp/",
      `${activeSession.username}/`,
      "README.md",
      "deploy.sh",
    ];
  }, [activeSession]);

  return (
    <main className="app-shell">
      {currentPage === "home" ? (
        <HomePage
          sessions={sessions}
          selectedId={selectedId}
          connectedId={activeTabId}
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
          sftpFiles={sftpFiles}
          onOpenSession={(id) => void connect(id)}
          onSwitchTab={setActiveTabId}
          onCloseTab={(id) => void closeTab(id)}
          onBackToHome={() => setCurrentPage("home")}
          onDisconnect={(id) => void disconnect(id)}
          terminals={tabs.map((id) => ({
            id,
            node: (
              <TerminalPane
                connected={connectedIds.includes(id)}
                registerWriter={(nextWriter) => {
                  writerMapRef.current.set(id, nextWriter);
                }}
                onInput={(text) => {
                  if (connectedIds.includes(id)) {
                    void sendInput(id, text).catch((err) => {
                      const message = err instanceof Error ? err.message : String(err);
                      setError(`发送失败: ${message}`);
                    });
                  }
                }}
                onResize={(cols, rows) => {
                  if (connectedIds.includes(id)) {
                    void resizeTerminal(id, cols, rows).catch((err) => {
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
