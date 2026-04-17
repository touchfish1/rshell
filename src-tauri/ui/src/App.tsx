import { useEffect, useMemo, useRef, useState } from "react";
import HomePage from "./pages/HomePage";
import TerminalPage from "./pages/TerminalPage";
import TerminalPane from "./components/TerminalPane";
import { DownloadToastStack } from "./components/download/DownloadToastStack";
import {
  connectSession,
  createSession,
  deleteSession,
  downloadSftpFile,
  disconnectSession,
  listSessions,
  getSessionSecret,
  getHostMetrics,
  resizeTerminal,
  sendInput,
  testHostReachability,
  updateSession,
} from "./services/bridge";
import type { Session, SessionInput } from "./services/types";
import { useDownloadTasks } from "./hooks/useDownloadTasks";
import { useSessionPing } from "./hooks/useSessionPing";
import { useSftpState } from "./hooks/useSftpState";
import { useTerminalOutput } from "./hooks/useTerminalOutput";
import { useUpdater } from "./hooks/useUpdater";
import { useWorkspaceTabs } from "./hooks/useWorkspaceTabs";

interface TerminalTab {
  id: string;
  sessionId: string;
  title: string;
}

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [currentPage, setCurrentPage] = useState<"home" | "terminal">("home");
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState<string | null>(null);
  const writerMapRef = useRef<Map<string, (content: string) => void>>(new Map());
  const { downloadTasks, createDownloadTask, finishDownloadTask } = useDownloadTasks();
  const { upgradeChecking, checkOnlineUpgrade } = useUpdater({ setStatus, setError });
  const [activeTabId, setActiveTabId] = useState<string | undefined>();
  const [tabsForSftp, setTabsForSftp] = useState<Array<{ id: string; sessionId: string }>>([]);
  const [connectedIdsForSftp, setConnectedIdsForSftp] = useState<string[]>([]);

  const { sftpProps, loadSftp, sftpOpenDir, sftpUp, clearTab } = useSftpState({
    activeTabId,
    tabs: tabsForSftp,
    connectedIds: connectedIdsForSftp,
    onError: (message) => setError(message),
  });

  const {
    connectedIds,
    setConnectedIds,
    tabs,
    activeTabId: hookActiveTabId,
    setActiveTabId: hookSetActiveTabId,
    currentPage: hookCurrentPage,
    setCurrentPage: hookSetCurrentPage,
    connect,
    disconnect,
    closeTab,
    duplicateTab,
    closeTabsToLeft,
    closeTabsToRight,
    closeOtherTabs,
    getTabsBySessionId,
    onBackToHome,
    terminals,
  } = useWorkspaceTabs({
    sessions,
    selectedId,
    writerMapRef,
    setStatus,
    setError,
    loadSftp,
    clearSftpTab: clearTab,
  });

  useEffect(() => {
    setTabsForSftp(terminals);
  }, [terminals]);

  useEffect(() => {
    setConnectedIdsForSftp(connectedIds);
  }, [connectedIds]);

  useEffect(() => {
    hookSetCurrentPage(currentPage);
  }, [currentPage, hookSetCurrentPage]);

  useEffect(() => {
    hookSetActiveTabId(activeTabId);
  }, [activeTabId, hookSetActiveTabId]);

  useEffect(() => {
    setCurrentPage(hookCurrentPage);
  }, [hookCurrentPage]);

  useEffect(() => {
    setActiveTabId(hookActiveTabId);
  }, [hookActiveTabId]);

  const { onlineMap, pingingIds } = useSessionPing({ currentPage, sessions });

  const writeToTab = useMemo(() => {
    return (tabId: string, text: string) => writerMapRef.current.get(tabId)?.(text);
  }, []);

  useTerminalOutput({
    sessions,
    connectedIds,
    getTabsBySessionId,
    writeToTab,
    onError: (message) => setError(message),
  });

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
    return;
  }, []);

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

  const remove = async (id: string) => {
    try {
      if (connectedIds.includes(id)) {
        await disconnectSession(id);
        setConnectedIds((prev) => prev.filter((sid) => sid !== id));
        tabs
          .filter((tab) => tab.sessionId === id)
          .forEach((tab) => {
            writerMapRef.current.delete(tab.id);
            clearTab(tab.id);
          });
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
          onOnlineUpgrade={checkOnlineUpgrade}
          upgradeChecking={upgradeChecking}
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
          sftpEntries={sftpProps.entries}
          sftpPath={sftpProps.path}
          sftpLoading={sftpProps.loading}
          onOpenSession={(id) => void connect(id)}
          onDuplicateTab={(id) => void duplicateTab(id)}
          onSelectSession={setSelectedId}
          onSwitchTab={setActiveTabId}
          onCloseTab={(id) => void closeTab(id)}
          onCloseTabsToLeft={(id) => void closeTabsToLeft(id)}
          onCloseTabsToRight={(id) => void closeTabsToRight(id)}
          onCloseOtherTabs={(id) => void closeOtherTabs(id)}
          onSftpOpenDir={sftpOpenDir}
          onSftpUp={sftpUp}
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
          onUpdateHost={update}
          onGetHostMetrics={(session) => getHostMetrics(session.id)}
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
      <DownloadToastStack tasks={downloadTasks} onError={(message) => setError(message)} />
    </main>
  );
}
