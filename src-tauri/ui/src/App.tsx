import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import HomePage from "./pages/HomePage";
import TerminalPage from "./pages/TerminalPage";
import TerminalPane from "./components/TerminalPane";
import { DownloadToastStack } from "./components/download/DownloadToastStack";
import { UpgradeConfirmModal } from "./components/UpgradeConfirmModal";
import { CloseConfirmModal } from "./components/CloseConfirmModal";
import {
  disconnectSession,
  downloadSftpFile,
  getHostMetrics,
  listAudits,
  readSftpTextFile,
  resizeTerminal,
  saveSftpTextFile,
  sendInput,
  uploadSftpFile,
} from "./services/bridge";
import type { AuditRecord, Session, SessionInput } from "./services/types";
import type { DownloadTask } from "./hooks/useDownloadTasks";
import { useDownloadTasks } from "./hooks/useDownloadTasks";
import { useSessionPing } from "./hooks/useSessionPing";
import { useSessionActions } from "./hooks/useSessionActions";
import { useSftpState } from "./hooks/useSftpState";
import { useTerminalOutput } from "./hooks/useTerminalOutput";
import { useUpdater } from "./hooks/useUpdater";
import { useSystemTray } from "./hooks/useSystemTray";
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
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const writerMapRef = useRef<Map<string, (content: string) => void>>(new Map());
  const { downloadTasks, createDownloadTask, finishDownloadTask, dismissDownloadTask } = useDownloadTasks();
  const tr = useMemo(
    () => (key: I18nKey, vars?: Record<string, string | number>) => t(lang, key, vars),
    [lang]
  );

  const switchLang = (next: Lang) => {
    setLang(next);
    setLangStorage(next);
  };

  const { upgradeChecking, checkOnlineUpgrade, upgradePrompt, resolveUpgradePrompt } = useUpdater({
    setStatus,
    setError,
    tr,
  });
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
    retryConnect,
    handlePullOutputFailure,
    connectingHostId,
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

  const connectedIdsRef = useRef<string[]>([]);
  connectedIdsRef.current = connectedIds;

  const runSftpDownload = useCallback(
    (sessionId: string, remotePath: string) => {
      const taskId = createDownloadTask(remotePath, sessionId);
      void downloadSftpFile(sessionId, remotePath)
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
    },
    [createDownloadTask, finishDownloadTask, setError, setStatus, tr]
  );

  const uploadSftpToRemoteDir = useCallback(
    async (sessionId: string, remoteDir: string, fileName: string, contentBase64: string) => {
      await uploadSftpFile(sessionId, remoteDir, fileName, contentBase64);
    },
    []
  );

  const onRetryDownload = useCallback(
    (task: DownloadTask) => {
      if (!task.sessionId || !task.remotePath) return;
      dismissDownloadTask(task.id);
      runSftpDownload(task.sessionId, task.remotePath);
    },
    [dismissDownloadTask, runSftpDownload]
  );

  const requestQuitOrDestroy = useCallback(() => {
    if (connectedIdsRef.current.length === 0) {
      void getCurrentWindow()
        .destroy()
        .catch(() => {});
      return;
    }
    setCloseConfirmOpen(true);
  }, []);

  useSystemTray({
    tooltip: tr("tray.tooltip"),
    showLabel: tr("tray.show"),
    quitLabel: tr("tray.quit"),
    onRequestQuit: requestQuitOrDestroy,
  });

  const confirmQuitApp = useCallback(async () => {
    setCloseConfirmOpen(false);
    const ids = [...connectedIdsRef.current];
    await Promise.all(ids.map((id) => disconnectSession(id).catch(() => {})));
    await getCurrentWindow()
      .destroy()
      .catch(() => {});
  }, []);

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
    onSessionTransportError: handlePullOutputFailure,
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

  const loadAudits = async () => {
    setAuditLoading(true);
    try {
      const data = await listAudits(300);
      setAudits(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <I18nProvider value={{ lang, tr }}>
      <main className="app-shell">
        {currentPage === "home" ? (
          <HomePage
            sessions={sessions}
            connectingSessionId={connectingHostId}
            selectedId={selectedId}
            onlineMap={onlineMap}
            pingingIds={pingingIds}
            connected={connectedIds.length > 0}
            error={error}
            onDismissError={() => setError(null)}
            status={status}
            onSelect={setSelectedId}
            onCreate={create}
            onUpdate={update}
            onDelete={remove}
            onTestConnect={testConnect}
            onGetSecret={getSecret}
            onConnect={connect}
            onOnlineUpgrade={checkOnlineUpgrade}
            auditOpen={auditOpen}
            auditLoading={auditLoading}
            audits={audits}
            onOpenAudit={() => {
              setAuditOpen(true);
              void loadAudits();
            }}
            onCloseAudit={() => setAuditOpen(false)}
            onRefreshAudit={() => {
              void loadAudits();
            }}
            upgradeChecking={upgradeChecking}
            lang={lang}
            onSwitchLang={switchLang}
            tr={tr}
          />
        ) : (
          <TerminalPage
            sessions={sessions}
            connectingSessionId={connectingHostId}
            selectedId={selectedId}
            activeTabId={activeTabId}
            tabs={tabs}
            connectedIds={connectedIds}
            error={error}
            onDismissError={() => setError(null)}
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
              runSftpDownload(tab.sessionId, remotePath);
            }}
            onSftpUpload={async (remoteDir: string, fileName: string, contentBase64: string) => {
              if (!activeTabId) throw new Error("no active terminal tab");
              const tab = tabs.find((t) => t.id === activeTabId);
              if (!tab) throw new Error("active terminal tab not found");
              await uploadSftpToRemoteDir(tab.sessionId, remoteDir, fileName, contentBase64);
              void loadSftp(activeTabId, tab.sessionId, remoteDir);
            }}
            onSftpReadText={async (remotePath: string) => {
              if (!activeTabId) throw new Error("no active terminal tab");
              const tab = tabs.find((t) => t.id === activeTabId);
              if (!tab) throw new Error("active terminal tab not found");
              return readSftpTextFile(tab.sessionId, remotePath);
            }}
            onSftpSaveText={async (remotePath: string, content: string) => {
              if (!activeTabId) throw new Error("no active terminal tab");
              const tab = tabs.find((t) => t.id === activeTabId);
              if (!tab) throw new Error("active terminal tab not found");
              await saveSftpTextFile(tab.sessionId, remotePath, content);
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
                  linkState={tab.linkState}
                  linkError={tab.linkError}
                  onRetryConnect={() => void retryConnect(tab.id)}
                  onCloseFailedTab={() => void closeTab(tab.id)}
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
        <DownloadToastStack
          tasks={downloadTasks}
          onError={(message) => setError(message)}
          onRetry={onRetryDownload}
          onDismiss={dismissDownloadTask}
        />
        {upgradePrompt ? (
          <UpgradeConfirmModal
            current={upgradePrompt.current}
            next={upgradePrompt.next}
            tr={tr}
            onConfirm={() => resolveUpgradePrompt(true)}
            onCancel={() => resolveUpgradePrompt(false)}
          />
        ) : null}
        {closeConfirmOpen ? (
          <CloseConfirmModal
            sessionCount={connectedIds.length}
            tr={tr}
            onConfirm={() => void confirmQuitApp()}
            onCancel={() => setCloseConfirmOpen(false)}
          />
        ) : null}
      </main>
    </I18nProvider>
  );
}
