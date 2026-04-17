import { useEffect, useRef, useState } from "react";
import HomePage from "./pages/HomePage";
import TerminalPage from "./pages/TerminalPage";
import TerminalPane from "./components/TerminalPane";
import {
  connectSession,
  createSession,
  deleteSession,
  downloadSftpFile,
  disconnectSession,
  listSftpDir,
  listSessions,
  onDebugLog,
  onTerminalOutput,
  getSessionSecret,
  openInFileManager,
  pullOutput,
  resizeTerminal,
  sendInput,
  testHostReachability,
  updateSession,
} from "./services/bridge";
import type { Session, SessionInput, SftpEntry } from "./services/types";

interface TerminalTab {
  id: string;
  sessionId: string;
  title: string;
}

interface DownloadTask {
  id: string;
  name: string;
  progress: number;
  status: "downloading" | "success" | "error";
  detail?: string;
  localPath?: string;
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
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});
  const [pingingIds, setPingingIds] = useState<string[]>([]);
  const [sftpEntriesMap, setSftpEntriesMap] = useState<Record<string, SftpEntry[]>>({});
  const [sftpPathMap, setSftpPathMap] = useState<Record<string, string>>({});
  const [sftpLoadingId, setSftpLoadingId] = useState<string | null>(null);
  const writerMapRef = useRef<Map<string, (content: string) => void>>(new Map());
  const tabsRef = useRef<TerminalTab[]>([]);
  const sessionsRef = useRef<Session[]>([]);
  const downloadTimerRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    return () => {
      downloadTimerRef.current.forEach((timer) => window.clearInterval(timer));
      downloadTimerRef.current.clear();
    };
  }, []);

  const createDownloadTask = (remotePath: string) => {
    const normalized = remotePath.replace(/\\/g, "/");
    const name = normalized.split("/").pop() || normalized;
    const id = `dl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    setDownloadTasks((prev) => [...prev, { id, name, progress: 6, status: "downloading" }]);
    const timer = window.setInterval(() => {
      setDownloadTasks((prev) =>
        prev.map((task) => {
          if (task.id !== id || task.status !== "downloading") return task;
          const next = Math.min(92, task.progress + Math.floor(Math.random() * 9 + 3));
          return { ...task, progress: next };
        })
      );
    }, 220);
    downloadTimerRef.current.set(id, timer);
    return id;
  };

  const finishDownloadTask = (id: string, ok: boolean, detail: string, localPath?: string) => {
    const timer = downloadTimerRef.current.get(id);
    if (timer) {
      window.clearInterval(timer);
      downloadTimerRef.current.delete(id);
    }
    setDownloadTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? { ...task, progress: 100, status: ok ? "success" : "error", detail, localPath }
          : task
      )
    );
    window.setTimeout(() => {
      setDownloadTasks((prev) => prev.filter((task) => task.id !== id));
    }, ok ? 2200 : 3600);
  };

  const normalizeEncoding = (encoding?: string) => {
    const value = (encoding || "utf-8").trim().toLowerCase();
    if (value === "utf8") return "utf-8";
    if (value === "gb2312") return "gbk";
    if (value === "cp936") return "gbk";
    return value;
  };

  const decodeOutput = (base64: string, sessionId: string) => {
    const session = sessionsRef.current.find((item) => item.id === sessionId);
    const preferredEncoding = normalizeEncoding(session?.encoding);
    const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
    try {
      return new TextDecoder(preferredEncoding).decode(bytes);
    } catch {
      return new TextDecoder("utf-8").decode(bytes);
    }
  };

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
      const plain = decodeOutput(payload.data, payload.sessionId);
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
            const plain = decodeOutput(base64, id);
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

  const update = async (id: string, input: SessionInput, secret?: string) => {
    try {
      const updated = await updateSession(id, input, secret);
      setSessions((prev) => prev.map((session) => (session.id === id ? updated : session)));
      setStatus(`已更新主机: ${updated.name}`);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`更新主机失败: ${message}`);
    }
  };

  const testConnect = async (input: SessionInput) => {
    return testHostReachability(input.host, input.port, 2000);
  };

  const getSecret = async (id: string) => {
    return getSessionSecret(id);
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
      void loadSftp(tabId, sessionId, "/");
      return;
    }
    try {
      await connectSession(sessionId);
      setConnectedIds((prev) => (prev.includes(sessionId) ? prev : [...prev, sessionId]));
      setStatus(`已连接: ${targetSession?.name ?? sessionId}`);
      void loadSftp(tabId, sessionId, "/");
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
          void loadSftp(tabId, sessionId, "/");
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
    const currentTabs = tabsRef.current;
    const targetIndex = currentTabs.findIndex((tab) => tab.id === targetTabId);
    const targetTab = currentTabs.find((tab) => tab.id === targetTabId);
    if (!targetTab) return;
    try {
      const remainTabsSameSession = currentTabs.filter(
        (tab) => tab.sessionId === targetTab.sessionId && tab.id !== targetTab.id
      );
      const nextTabs = currentTabs.filter((tab) => tab.id !== targetTab.id);
      if (remainTabsSameSession.length === 0 && connectedIds.includes(targetTab.sessionId)) {
        await disconnectSession(targetTab.sessionId);
        setConnectedIds((prev) => prev.filter((sid) => sid !== targetTab.sessionId));
      }
      tabsRef.current = nextTabs;
      setTabs(nextTabs);
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
      const nextActiveId =
        targetIndex > 0
          ? nextTabs[targetIndex - 1]?.id
          : nextTabs[targetIndex]?.id ?? nextTabs[nextTabs.length - 1]?.id;
      setActiveTabId((prev) => {
        if (prev !== targetTab.id) return prev;
        return nextActiveId;
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

  const duplicateTab = async (id: string) => {
    const tab = tabsRef.current.find((item) => item.id === id);
    if (!tab) return;
    await connect(tab.sessionId);
  };

  const closeTabsBatch = async (tabIds: string[]) => {
    for (const tabId of tabIds) {
      await disconnect(tabId);
    }
  };

  const closeTabsToLeft = async (id: string) => {
    const current = tabsRef.current;
    const index = current.findIndex((tab) => tab.id === id);
    if (index <= 0) return;
    const targets = current.slice(0, index).map((tab) => tab.id);
    await closeTabsBatch(targets);
  };

  const closeTabsToRight = async (id: string) => {
    const current = tabsRef.current;
    const index = current.findIndex((tab) => tab.id === id);
    if (index < 0 || index === current.length - 1) return;
    const targets = current.slice(index + 1).map((tab) => tab.id);
    await closeTabsBatch(targets);
  };

  const closeOtherTabs = async (id: string) => {
    const current = tabsRef.current;
    const targets = current.filter((tab) => tab.id !== id).map((tab) => tab.id);
    await closeTabsBatch(targets);
  };

  const normalizeSftpPath = (path?: string) => {
    if (!path || path === ".") return "/";
    return path;
  };

  const loadSftp = async (tabId: string, sessionId: string, path?: string) => {
    setSftpLoadingId(tabId);
    try {
      const nextPath = normalizeSftpPath(path ?? sftpPathMap[tabId] ?? "/");
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

  useEffect(() => {
    let cancelled = false;
    if (currentPage !== "home" || sessions.length === 0) return;

    const runPing = async () => {
      const ids = sessions.map((session) => session.id);
      if (!cancelled) setPingingIds(ids);
      const results = await Promise.all(
        sessions.map(async (session) => {
          try {
            const ok = await testHostReachability(session.host, session.port, 1500);
            return [session.id, ok] as const;
          } catch {
            return [session.id, false] as const;
          }
        })
      );
      if (cancelled) return;
      setOnlineMap((prev) => {
        const next = { ...prev };
        results.forEach(([id, ok]) => {
          next[id] = ok;
        });
        return next;
      });
      setPingingIds([]);
    };

    void runPing();
    const timer = window.setInterval(() => {
      void runPing();
    }, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [currentPage, sessions]);

  return (
    <main className="app-shell">
      {currentPage === "home" ? (
        <HomePage
          sessions={sessions}
          selectedId={selectedId}
          onlineMap={onlineMap}
          pingingIds={pingingIds}
          connected={connectedIds.length > 0}
          error={error}
          status={status}
          onSelect={setSelectedId}
          onCreate={create}
          onUpdate={update}
          onDelete={remove}
          onTestConnect={testConnect}
          onGetSecret={getSecret}
          onConnect={connect}
        />
      ) : (
        <TerminalPage
          sessions={sessions}
          selectedId={selectedId}
          activeTabId={activeTabId}
          tabs={tabs}
          connectedIds={connectedIds}
          error={error}
          status={status}
          sftpEntries={activeTabId ? sftpEntriesMap[activeTabId] ?? [] : []}
          sftpPath={activeTabId ? sftpPathMap[activeTabId] ?? "/" : "/"}
          sftpLoading={Boolean(activeTabId && sftpLoadingId === activeTabId)}
          onOpenSession={(id) => void connect(id)}
          onDuplicateTab={(id) => void duplicateTab(id)}
          onSelectSession={setSelectedId}
          onSwitchTab={setActiveTabId}
          onCloseTab={(id) => void closeTab(id)}
          onCloseTabsToLeft={(id) => void closeTabsToLeft(id)}
          onCloseTabsToRight={(id) => void closeTabsToRight(id)}
          onCloseOtherTabs={(id) => void closeOtherTabs(id)}
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
            const current = normalizeSftpPath(sftpPathMap[activeTabId] ?? "/");
            if (current === "/") return;
            const normalized = current.replace(/\/+$/, "");
            const idx = normalized.lastIndexOf("/");
            const parent = idx <= 0 ? "/" : normalized.slice(0, idx);
            void loadSftp(activeTabId, tab.sessionId, parent);
          }}
          onSftpDownload={(remotePath: string) => {
            if (!activeTabId) return;
            const tab = tabs.find((t) => t.id === activeTabId);
            if (!tab) return;
            const taskId = createDownloadTask(remotePath);
            void downloadSftpFile(tab.sessionId, remotePath)
              .then((savedPath) => {
                setStatus(`已下载到: ${savedPath}`);
                setError(null);
                finishDownloadTask(taskId, true, savedPath, savedPath);
              })
              .catch((err) => {
                const message = err instanceof Error ? err.message : String(err);
                setError(`下载失败: ${message}`);
                finishDownloadTask(taskId, false, message);
              });
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
      {downloadTasks.length > 0 ? (
        <div className="download-toast-stack">
          {downloadTasks.map((task) => (
            <div key={task.id} className={`download-toast ${task.status}`}>
              <div className="download-title">
                <span className="download-name" title={task.name}>
                  {task.name}
                </span>
                <span className="download-status">
                  {task.status === "downloading"
                    ? "下载中"
                    : task.status === "success"
                      ? "完成"
                      : "失败"}
                </span>
                {task.status === "success" && task.localPath ? (
                  <button
                    className="download-open-btn"
                    title="打开文件目录"
                    onClick={() => {
                      void openInFileManager(task.localPath!).catch((err) => {
                        const message = err instanceof Error ? err.message : String(err);
                        setError(`打开目录失败: ${message}`);
                      });
                    }}
                  >
                    📂
                  </button>
                ) : null}
              </div>
              <div className="download-detail" title={task.detail}>
                {task.detail ?? "正在下载到本地..."}
              </div>
              <div className="download-bar">
                <span style={{ width: `${task.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </main>
  );
}
