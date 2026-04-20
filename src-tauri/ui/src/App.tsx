import { AppHomeSection } from "./app/AppHomeSection";
import { AppTerminalSection } from "./app/AppTerminalSection";
import { AppZookeeperSection } from "./app/AppZookeeperSection";
import { DownloadToastStack } from "./components/download/DownloadToastStack";
import { UpgradeConfirmModal } from "./components/UpgradeConfirmModal";
import { CloseConfirmModal } from "./components/CloseConfirmModal";
import { I18nProvider } from "./i18n-context";
import { AppRedisSection } from "./app/AppRedisSection";
import { useAppShell } from "./hooks/useAppShell";

export default function App() {
  const {
    lang,
    tr,
    switchLang,
    currentPage,
    setCurrentPage,
    sessions,
    selectedId,
    setSelectedId,
    zkConnections,
    selectedZkId,
    setSelectedZkId,
    redisConnections,
    selectedRedisId,
    setSelectedRedisId,
    status,
    error,
    setError,
    tabs,
    activeTabId,
    setActiveTabId,
    connectedIds,
    connectingHostId,
    writerMapRef,
    sftpProps,
    sftpOpenDir,
    sftpUp,
    loadSftp,
    connect,
    disconnect,
    closeTab,
    duplicateTab,
    closeTabsToLeft,
    closeTabsToRight,
    closeOtherTabs,
    retryConnect,
    runSftpDownload,
    uploadSftpToRemoteDir,
    create,
    update,
    remove,
    testConnect,
    getSecret,
    createZk,
    updateZk,
    removeZk,
    getZkSecret,
    testZkConnection,
    createRedis,
    updateRedis,
    removeRedis,
    getRedisSecret,
    reachabilityMap,
    refreshBusy,
    refreshReachability,
    downloadTasks,
    dismissDownloadTask,
    onRetryDownload,
    auditOpen,
    setAuditOpen,
    auditLoading,
    audits,
    loadAudits,
    upgradeChecking,
    checkOnlineUpgrade,
    upgradePrompt,
    resolveUpgradePrompt,
    closeConfirmOpen,
    setCloseConfirmOpen,
    confirmQuitApp,
  } = useAppShell();

  return (
    <I18nProvider value={{ lang, tr }}>
      <main className="app-shell">
        {currentPage === "home" ? (
          <AppHomeSection
            sessions={sessions}
            zkConnections={zkConnections}
            redisConnections={redisConnections}
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
            onCreateRedis={createRedis}
            onUpdate={update}
            onDelete={remove}
            onTestConnect={testConnect}
            onTestZk={testZkConnection}
            onGetSecret={getSecret}
            onGetZkSecret={getZkSecret}
            onConnect={connect}
            onConnectZk={(id: string) => {
              setSelectedZkId(id);
              setCurrentPage("zookeeper");
            }}
            onUpdateZk={updateZk}
            onDeleteZk={removeZk}
            onConnectRedis={(id: string) => {
              setSelectedRedisId(id);
              setCurrentPage("redis");
            }}
            onGetRedisSecret={getRedisSecret}
            onUpdateRedis={updateRedis}
            onDeleteRedis={removeRedis}
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
            onOpenRedis={() => setCurrentPage("redis")}
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
        ) : currentPage === "zookeeper" ? (
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
        ) : (
          <AppRedisSection
            connections={redisConnections}
            selectedId={selectedRedisId}
            status={status}
            error={error}
            onDismissError={() => setError(null)}
            onSelect={setSelectedRedisId}
            onCreate={createRedis}
            onUpdate={updateRedis}
            onDelete={removeRedis}
            onGetSecret={getRedisSecret}
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
