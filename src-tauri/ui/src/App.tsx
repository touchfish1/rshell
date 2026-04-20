import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppHomeSection } from "./app/AppHomeSection";
import { AppTerminalSection } from "./app/AppTerminalSection";
import { AppZookeeperSection } from "./app/AppZookeeperSection";
import { DownloadToastStack } from "./components/download/DownloadToastStack";
import { UpgradeConfirmModal } from "./components/UpgradeConfirmModal";
import { CloseConfirmModal } from "./components/CloseConfirmModal";
import { downloadSftpFile, testZookeeperConnection, uploadSftpFile } from "./services/bridge";
import type { Session } from "./services/types";
import type { DownloadTask } from "./hooks/useDownloadTasks";
import { useDownloadTasks } from "./hooks/useDownloadTasks";
import { useSessionPing } from "./hooks/useSessionPing";
import { useSessionActions } from "./hooks/useSessionActions";
import { useZookeeperActions } from "./hooks/useZookeeperActions";
import { useSftpState } from "./hooks/useSftpState";
import { useTerminalOutput } from "./hooks/useTerminalOutput";
import { useUpdater } from "./hooks/useUpdater";
import { useSystemTray } from "./hooks/useSystemTray";
import { useWorkspaceTabs } from "./hooks/useWorkspaceTabs";
import { useAuditLogs } from "./hooks/useAuditLogs";
import { useQuitConfirm } from "./hooks/useQuitConfirm";
import { detectInitialLang, setLangStorage, t, type I18nKey, type Lang } from "./i18n";
import { I18nProvider } from "./i18n-context";
import type { ZookeeperConnection, ZookeeperConnectionInput } from "./services/types";

export default function App() {
  const [lang, setLang] = useState<Lang>(() => detectInitialLang());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [currentPage, setCurrentPage] = useState<"home" | "terminal" | "zookeeper">("home");
  const [zkConnections, setZkConnections] = useState<ZookeeperConnection[]>([]);
  const [selectedZkId, setSelectedZkId] = useState<string | undefined>();
  const [status, setStatus] = useState(() => t(detectInitialLang(), "status.idle"));
  const [error, setError] = useState<string | null>(null);
  const writerMapRef = useRef<Map<string, (content: string) => void>>(new Map());
  const { downloadTasks, createDownloadTask, finishDownloadTask, dismissDownloadTask } = useDownloadTasks();
  const { auditOpen, setAuditOpen, auditLoading, audits, loadAudits } = useAuditLogs(setError);
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

  const { closeConfirmOpen, setCloseConfirmOpen, requestQuitOrDestroy, confirmQuitApp } =
    useQuitConfirm(connectedIds);

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

  useSystemTray({
    tooltip: tr("tray.tooltip"),
    showLabel: tr("tray.show"),
    quitLabel: tr("tray.quit"),
    onRequestQuit: requestQuitOrDestroy,
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

  const { reachabilityMap, refreshBusy, refreshReachability } = useSessionPing({ currentPage, sessions });

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

  const {
    create: createZk,
    update: updateZk,
    remove: removeZk,
    getSecret: getZkSecret,
  } = useZookeeperActions({
    connections: zkConnections,
    setConnections: setZkConnections,
    selectedId: selectedZkId,
    setSelectedId: setSelectedZkId,
    setStatus,
    setError,
    tr,
  });

  return (
    <I18nProvider value={{ lang, tr }}>
      <main className="app-shell">
        {currentPage === "home" ? (
          <AppHomeSection
            sessions={sessions}
            zkConnections={zkConnections}
            connectingSessionId={connectingHostId}
            selectedId={selectedId}
            reachabilityMap={reachabilityMap}
            refreshBusy={refreshBusy}
            connected={connectedIds.length > 0}
            error={error}
            onDismissError={() => setError(null)}
            status={status}
            onSelect={setSelectedId}
            onCreate={create}
            onCreateZk={createZk}
            onUpdate={update}
            onDelete={remove}
            onTestConnect={testConnect}
            onTestZk={async (input: ZookeeperConnectionInput, secret?: string) => {
              await testZookeeperConnection(input.connect_string, input.session_timeout_ms, secret);
            }}
            onGetSecret={getSecret}
            onGetZkSecret={getZkSecret}
            onConnect={connect}
            onConnectZk={(id: string) => {
              setSelectedZkId(id);
              setCurrentPage("zookeeper");
            }}
            onUpdateZk={updateZk}
            onDeleteZk={removeZk}
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
            onRefreshHostStatus={refreshReachability}
            onOpenZookeeper={() => setCurrentPage("zookeeper")}
            tr={tr}
          />
        ) : currentPage === "terminal" ? (
          <AppTerminalSection
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
            onOpenSession={(id) => connect(id)}
            onDuplicateTab={(id) => duplicateTab(id)}
            onSelectSession={setSelectedId}
            onSwitchTab={setActiveTabId}
            onCloseTab={(id) => closeTab(id)}
            onCloseTabsToLeft={(id) => closeTabsToLeft(id)}
            onCloseTabsToRight={(id) => closeTabsToRight(id)}
            onCloseOtherTabs={(id) => closeOtherTabs(id)}
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
            onBackToHome={() => setCurrentPage("home")}
            onDisconnect={(id) => disconnect(id)}
            onUpdateHost={update}
            retryConnect={(tabId) => retryConnect(tabId)}
            writerMapRef={writerMapRef}
            setError={setError}
          />
        ) : (
          <AppZookeeperSection
            connections={zkConnections}
            selectedId={selectedZkId}
            status={status}
            error={error}
            onDismissError={() => setError(null)}
            onSelect={setSelectedZkId}
            onCreate={createZk}
            onUpdate={updateZk}
            onDelete={removeZk}
            onGetSecret={getZkSecret}
            onBack={() => setCurrentPage("home")}
            tr={tr}
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
