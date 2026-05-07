import { AppHomeSection } from "./app/AppHomeSection";
import { AppTerminalSection } from "./app/AppTerminalSection";
import { AppZookeeperSection } from "./app/AppZookeeperSection";
import { DownloadToastStack } from "./components/download/DownloadToastStack";
import { UpgradeConfirmModal } from "./components/UpgradeConfirmModal";
import { CloseConfirmModal } from "./components/CloseConfirmModal";
import { I18nProvider } from "./i18n-context";
import { AppRedisSection } from "./app/AppRedisSection";
import { AppEtcdSection } from "./app/AppEtcdSection";
import { AppMySqlSection } from "./app/AppMySqlSection";
import { useAppShell } from "./hooks/useAppShell";
import { CommandPaletteModal } from "./components/CommandPaletteModal";
import { SettingsModal } from "./components/SettingsModal";
import { HostCreateModal } from "./components/session/HostCreateModal";
import { useSessionListForms } from "./components/session/useSessionListForms";
import { useCommandPaletteItems } from "./hooks/useCommandPaletteItems";
import { useEffect, useMemo, useState } from "react";

export default function App() {
  const {
    lang,
    tr,
    environments,
    currentEnvironment,
    environmentBusy,
    switchCurrentEnvironment,
    createAndSwitchEnvironment,
    renameEnvironment,
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
    mysqlConnections,
    selectedMysqlId,
    setSelectedMysqlId,
    postgresqlConnections,
    selectedPostgresqlId,
    setSelectedPostgresqlId,
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
    createMysql,
    updateMysql,
    removeMysql,
    getMysqlSecret,
    createPostgreSql,
    updatePostgreSql,
    removePostgreSql,
    getPostgreSqlSecret,
    etcdConnections,
    selectedEtcdId,
    setSelectedEtcdId,
    createEtcd,
    updateEtcd,
    removeEtcd,
    getEtcdSecret,
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

  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const unifiedForms = useSessionListForms({
    onCreate: create,
    onCreateZk: createZk,
    onCreateRedis: createRedis,
    onCreateMySql: createMysql,
    onCreatePostgreSql: createPostgreSql,
    onUpdate: update,
    onTestConnect: testConnect,
    onTestZk: testZkConnection,
    onGetSecret: getSecret,
    onConnect: connect,
    onConnectZk: (id: string) => {
      setSelectedZkId(id);
      setCurrentPage("zookeeper");
    },
    onConnectRedis: (id: string) => {
      setSelectedRedisId(id);
      setCurrentPage("redis");
    },
    onConnectMySql: (id: string) => {
      setSelectedMysqlId(id);
      setCurrentPage("mysql");
    },
    onConnectPostgreSql: (id: string) => {
      setSelectedPostgresqlId(id);
      setCurrentPage("home");
    },
    tr,
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdkOpen(true);
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const { cmdkItems } = useCommandPaletteItems({
    tr,
    currentPage,
    setCurrentPage,
    refreshBusy,
    refreshReachability,
    setAuditOpen,
    loadAudits,
    activeTabId,
    disconnect,
    closeTab,
    retryConnect,
    tabs,
    loadSftp,
    sftpPath: sftpProps.path,
    selectedRedisId,
    selectedId,
    connect,
  });

  const openedConnectionTypeOptions = useMemo(() => {
    const options: Array<{ value: "terminal" | "zookeeper" | "redis" | "mysql" | "etcd"; label: string }> = [];
    if (sessions.length > 0) options.push({ value: "terminal", label: tr("terminal.workspace") });
    if (zkConnections.length > 0) options.push({ value: "zookeeper", label: tr("home.zookeeper") });
    if (redisConnections.length > 0) options.push({ value: "redis", label: tr("home.redis") });
    if (mysqlConnections.length > 0) options.push({ value: "mysql", label: tr("home.mysql") });
    if (etcdConnections.length > 0) options.push({ value: "etcd", label: tr("home.etcd") });
    if (options.length === 0) {
      options.push({ value: "terminal", label: tr("terminal.workspace") });
    }
    return options;
  }, [sessions.length, zkConnections.length, redisConnections.length, mysqlConnections.length, etcdConnections.length, tr]);

  const subpageCurrentType = currentPage === "mysqlData" ? "mysql" : currentPage;
  const subpageSelectValue = openedConnectionTypeOptions.some((item) => item.value === subpageCurrentType)
    ? subpageCurrentType
    : openedConnectionTypeOptions[0].value;
  const subpageContainerStyle = {
    height: "calc(100vh - 56px)",
    overflow: "hidden",
  } as const;

  return (
    <I18nProvider value={{ lang, tr }}>
      <main
        className="app-shell"
        style={currentPage === "home" ? undefined : { height: "100vh", overflow: "hidden" }}
      >
        {currentPage !== "home" ? (
          <header className="topbar">
            <div className="topbar-title">
              <div className="app-badge" aria-hidden="true">
                r
              </div>
              <div className="topbar-title-text">
                <div className="topbar-title-line">rshell</div>
                <div className="topbar-subtitle">{tr("top.subtitle")}</div>
              </div>
            </div>
            <div className="actions">
              <button className="btn btn-ghost settings-gear-btn" onClick={() => setSettingsOpen(true)} title={tr("settings.title")}>
                ⚙
              </button>
              <div className="lang-switch" role="group" aria-label={tr("top.ariaLanguageSwitch")}>
                <button
                  className={`btn btn-ghost ${lang === "zh-CN" ? "lang-active" : ""}`}
                  onClick={() => switchLang("zh-CN")}
                  title={tr("lang.switchToZh")}
                  aria-pressed={lang === "zh-CN"}
                >
                  {tr("lang.zh")}
                </button>
                <button
                  className={`btn btn-ghost ${lang === "en-US" ? "lang-active" : ""}`}
                  onClick={() => switchLang("en-US")}
                  title={tr("lang.switchToEn")}
                  aria-pressed={lang === "en-US"}
                >
                  {tr("lang.en")}
                </button>
              </div>
              <button className="btn btn-ghost" onClick={() => setCurrentPage("home")}>
                {tr("terminal.back")}
              </button>
              <button className="btn btn-ghost lang-active" onClick={() => unifiedForms.setShowCreateModal(true)}>
                {tr("top.addConnection")}
              </button>
              <select
                className="btn btn-ghost"
                aria-label={tr("top.ariaConnectionTypeSwitch")}
                value={subpageSelectValue}
                onChange={(event) => setCurrentPage(event.target.value as "terminal" | "zookeeper" | "redis" | "mysql" | "etcd")}
              >
                {openedConnectionTypeOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <span className="pill pill-muted">{status}</span>
            </div>
          </header>
        ) : null}
        <div style={{ display: currentPage === "home" ? "" : "none" }}>
          <AppHomeSection
            sessions={sessions}
            zkConnections={zkConnections}
            redisConnections={redisConnections}
            mysqlConnections={mysqlConnections}
            postgresqlConnections={postgresqlConnections}
            etcdConnections={etcdConnections}
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
            onCreateMysql={createMysql}
            onCreatePostgreSql={createPostgreSql}
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
            onConnectMysql={(id: string) => {
              setSelectedMysqlId(id);
              setCurrentPage("mysql");
            }}
            onConnectPostgreSql={(id: string) => {
              setSelectedPostgresqlId(id);
              setCurrentPage("home");
            }}
            onGetRedisSecret={getRedisSecret}
            onUpdateRedis={updateRedis}
            onDeleteRedis={removeRedis}
            onDeleteMysql={removeMysql}
            onGetMysqlSecret={getMysqlSecret}
            onUpdateMysql={updateMysql}
            onDeletePostgreSql={removePostgreSql}
            onGetPostgreSqlSecret={getPostgreSqlSecret}
            onUpdatePostgreSql={updatePostgreSql}
            onConnectEtcd={(id: string) => {
              setSelectedEtcdId(id);
              setCurrentPage("etcd");
            }}
            onCreateEtcd={createEtcd}
            onDeleteEtcd={removeEtcd}
            onGetEtcdSecret={getEtcdSecret}
            onUpdateEtcd={updateEtcd}
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
            environments={environments}
            currentEnvironment={currentEnvironment}
            environmentBusy={environmentBusy}
            onSwitchEnvironment={switchCurrentEnvironment}
            onCreateEnvironment={createAndSwitchEnvironment}
            onRenameEnvironment={renameEnvironment}
            tr={tr}
            onOpenUnifiedCreate={() => unifiedForms.setShowCreateModal(true)}
          />
        </div>
        <div style={{ display: currentPage === "terminal" ? "" : "none", ...subpageContainerStyle }}>
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
            onNavigateZk={() => setCurrentPage("zookeeper")}
            onNavigateRedis={() => setCurrentPage("redis")}
            onNavigateMysql={() => setCurrentPage("mysql")}
            onNavigateEtcd={() => setCurrentPage("etcd")}
            onOpenCreate={() => setCurrentPage("home")}
          />
        </div>
        <div style={{ display: currentPage === "zookeeper" ? "" : "none", ...subpageContainerStyle }}>
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
            onOpenUnifiedCreate={() => unifiedForms.setShowCreateModal(true)}
          />
        </div>
        <div style={{ display: currentPage === "redis" ? "" : "none", ...subpageContainerStyle }}>
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
            lang={lang}
            onSwitchLang={switchLang}
            onBack={() => setCurrentPage("home")}
            tr={tr}
            onOpenUnifiedCreate={() => unifiedForms.setShowCreateModal(true)}
          />
        </div>
        <div style={{ display: currentPage === "etcd" ? "" : "none", ...subpageContainerStyle }}>
          <AppEtcdSection
            connections={etcdConnections}
            selectedId={selectedEtcdId}
            status={status}
            error={error}
            onDismissError={() => setError(null)}
            onSelect={setSelectedEtcdId}
            onCreate={createEtcd}
            onUpdate={updateEtcd}
            onDelete={removeEtcd}
            onGetSecret={getEtcdSecret}
            onBack={() => setCurrentPage("home")}
            tr={tr}
            onOpenUnifiedCreate={() => unifiedForms.setShowCreateModal(true)}
          />
        </div>
        <div style={{ display: currentPage === "mysql" || currentPage === "mysqlData" ? "" : "none", ...subpageContainerStyle }}>
          <AppMySqlSection
            connections={mysqlConnections}
            selectedId={selectedMysqlId}
            status={status}
            error={error}
            onDismissError={() => setError(null)}
            onSelect={setSelectedMysqlId}
            onCreate={createMysql}
            onUpdate={updateMysql}
            onDelete={removeMysql}
            onGetSecret={getMysqlSecret}
            onBack={() => setCurrentPage("home")}
            tr={tr}
            onOpenUnifiedCreate={() => unifiedForms.setShowCreateModal(true)}
          />
        </div>
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
        <HostCreateModal
          open={unifiedForms.showCreateModal}
          form={unifiedForms.createForm}
          secret={unifiedForms.createSecret}
          testing={unifiedForms.createTesting}
          saving={unifiedForms.createSubmitting}
          testResult={unifiedForms.createTestResult}
          hostInputRef={unifiedForms.hostInputRef}
          protocolPort={unifiedForms.createProtocolPort}
          onClose={() => unifiedForms.setShowCreateModal(false)}
          onChangeForm={unifiedForms.setCreateForm}
          onChangeSecret={unifiedForms.setCreateSecret}
          onTest={() => void unifiedForms.testCreateConnect()}
          onSubmit={() => void unifiedForms.submitCreate(false)}
          onSubmitAndConnect={() => void unifiedForms.submitCreate(true)}
        />
        <CommandPaletteModal open={cmdkOpen} tr={tr} items={cmdkItems} onClose={() => setCmdkOpen(false)} />
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          tr={tr}
          lang={lang}
          onSwitchLang={switchLang}
        />
      </main>
    </I18nProvider>
  );
}
