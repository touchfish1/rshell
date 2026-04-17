import { useEffect, useMemo, useRef, useState } from "react";
import HomePage from "./pages/HomePage";
import TerminalPage from "./pages/TerminalPage";
import TerminalPane from "./components/TerminalPane";
import { DownloadToastStack } from "./components/download/DownloadToastStack";
import {
  downloadSftpFile,
  getHostMetrics,
  resizeTerminal,
  sendInput,
} from "./services/bridge";
import type { Session, SessionInput } from "./services/types";
import { useDownloadTasks } from "./hooks/useDownloadTasks";
import { useSessionPing } from "./hooks/useSessionPing";
import { useSessionActions } from "./hooks/useSessionActions";
import { useSftpState } from "./hooks/useSftpState";
import { useTerminalOutput } from "./hooks/useTerminalOutput";
import { useUpdater } from "./hooks/useUpdater";
import { useWorkspaceTabs } from "./hooks/useWorkspaceTabs";
import { detectInitialLang, setLangStorage, t, type I18nKey, type Lang } from "./i18n";
import { I18nProvider } from "./i18n-context";

export default function App() {
  const [lang, setLang] = useState<Lang>(() => detectInitialLang());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [currentPage, setCurrentPage] = useState<"home" | "terminal">("home");
  const [status, setStatus] = useState(() => t(detectInitialLang(), "status.idle"));
  const [error, setError] = useState<string | null>(null);
  const writerMapRef = useRef<Map<string, (content: string) => void>>(new Map());
  const { downloadTasks, createDownloadTask, finishDownloadTask } = useDownloadTasks();
  const tr = useMemo(
    () => (key: I18nKey, vars?: Record<string, string | number>) => t(lang, key, vars),
    [lang]
  );

  const switchLang = (next: Lang) => {
    setLang(next);
    setLangStorage(next);
  };

  const { upgradeChecking, checkOnlineUpgrade } = useUpdater({ setStatus, setError, tr });
  const [activeTabId, setActiveTabId] = useState<string | undefined>();
  const [tabsForSftp, setTabsForSftp] = useState<Array<{ id: string; sessionId: string }>>([]);
  const [connectedIdsForSftp, setConnectedIdsForSftp] = useState<string[]>([]);

  const { sftpProps, loadSftp, sftpOpenDir, sftpUp, clearTab } = useSftpState({
    activeTabId,
    tabs: tabsForSftp,
    connectedIds: connectedIdsForSftp,
    onError: (message) => setError(message),
    tr,
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
    tr,
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
    tr,
  });

  const { create, update, remove, testConnect, getSecret } = useSessionActions({
    sessions,
    setSessions,
    selectedId,
    setSelectedId,
    connectedIds,
    setConnectedIds,
    tabs,
    clearTab,
    writerMapRef,
    setStatus,
    setError,
    tr,
  });


  return (
    <I18nProvider value={{ lang, tr }}>
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
          lang={lang}
          onSwitchLang={switchLang}
          tr={tr}
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
          tr={tr}
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
                setStatus(tr("status.downloadedTo", { path: savedPath }));
                setError(null);
                finishDownloadTask(taskId, true, savedPath, savedPath);
              })
              .catch((err) => {
                const message = err instanceof Error ? err.message : String(err);
                setError(tr("error.downloadFailed", { message }));
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
                      setError(tr("error.sendFailed", { message }));
                    });
                  }
                }}
                onResize={(cols, rows) => {
                  if (connectedIds.includes(tab.sessionId) && activeTabId === tab.id) {
                    void resizeTerminal(tab.sessionId, cols, rows).catch((err) => {
                      const message = err instanceof Error ? err.message : String(err);
                      setError(tr("error.resizeTerminalFailed", { message }));
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
    </I18nProvider>
  );
}
