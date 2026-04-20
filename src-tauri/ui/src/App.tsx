import { AppHomeSection } from "./app/AppHomeSection";
import { AppTerminalSection } from "./app/AppTerminalSection";
import { AppZookeeperSection } from "./app/AppZookeeperSection";
import { DownloadToastStack } from "./components/download/DownloadToastStack";
import { UpgradeConfirmModal } from "./components/UpgradeConfirmModal";
import { CloseConfirmModal } from "./components/CloseConfirmModal";
import { I18nProvider } from "./i18n-context";
import { AppRedisSection } from "./app/AppRedisSection";
import { useAppShell } from "./hooks/useAppShell";
import { CommandPaletteModal, type CommandPaletteItem } from "./components/CommandPaletteModal";
import { useEffect, useMemo, useState } from "react";

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

  const [cmdkOpen, setCmdkOpen] = useState(false);

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

  const cmdkItems = useMemo<CommandPaletteItem[]>(() => {
    const items: CommandPaletteItem[] = [];

    items.push({
      id: "nav:home",
      label: "返回首页",
      keywords: ["home", "首页", "返回"],
      run: () => setCurrentPage("home"),
    });
    items.push({
      id: "nav:terminal",
      label: "打开终端页",
      keywords: ["terminal", "终端", "host"],
      run: () => setCurrentPage("terminal"),
    });
    items.push({
      id: "nav:zookeeper",
      label: "打开 Zookeeper",
      keywords: ["zk", "zookeeper", "zoo", "zookeeper页"],
      run: () => setCurrentPage("zookeeper"),
    });
    items.push({
      id: "nav:redis",
      label: "打开 Redis",
      keywords: ["redis", "cache", "kv", "redis页"],
      run: () => setCurrentPage("redis"),
    });

    if (currentPage === "home") {
      items.push({
        id: "home:refreshReachability",
        label: "刷新主机状态",
        keywords: ["刷新", "状态", "ping", "reachability"],
        disabled: refreshBusy,
        hint: refreshBusy ? "检测中…" : undefined,
        run: () => refreshReachability(),
      });
      items.push({
        id: "home:audit",
        label: "打开审计日志",
        keywords: ["audit", "日志", "审计"],
        run: () => {
          setAuditOpen(true);
          void loadAudits();
        },
      });
    }

    if (currentPage === "terminal") {
      items.push({
        id: "terminal:disconnect",
        label: "断开当前会话",
        keywords: ["disconnect", "断开", "close"],
        disabled: !activeTabId,
        run: () => {
          if (activeTabId) disconnect(activeTabId);
        },
      });
      items.push({
        id: "terminal:closeTab",
        label: "关闭当前标签",
        keywords: ["tab", "close", "关闭标签"],
        disabled: !activeTabId,
        run: () => {
          if (activeTabId) closeTab(activeTabId);
        },
      });
      items.push({
        id: "terminal:retry",
        label: "重试连接（当前标签）",
        keywords: ["retry", "重试", "reconnect"],
        disabled: !activeTabId,
        run: () => {
          if (activeTabId) retryConnect(activeTabId);
        },
      });
      items.push({
        id: "terminal:sftpReload",
        label: "刷新 SFTP 列表",
        keywords: ["sftp", "refresh", "刷新文件"],
        disabled: !activeTabId,
        run: () => {
          if (!activeTabId) return;
          const tab = tabs.find((t) => t.id === activeTabId);
          if (!tab) return;
          void loadSftp(activeTabId, tab.sessionId, sftpProps.path);
        },
      });
    }

    if (currentPage === "redis") {
      items.push({
        id: "redis:disconnect",
        label: "断开 Redis 当前连接",
        keywords: ["redis", "disconnect", "断开"],
        disabled: !selectedRedisId,
        run: () => {
          if (!selectedRedisId) return;
          // RedisPage 内也有断开按钮，这里回到首页级别只做页面切换触发用户手动断开
          setCurrentPage("redis");
        },
      });
    }

    // 常用：连接选中主机（无论在哪个页都可用）
    items.push({
      id: "host:connectSelected",
      label: "连接选中主机（新建标签）",
      keywords: ["connect", "连接", "ssh", "telnet"],
      disabled: !selectedId,
      run: async () => {
        if (!selectedId) return;
        await connect(selectedId);
      },
    });

    return items;
  }, [
    activeTabId,
    closeTab,
    connect,
    currentPage,
    disconnect,
    loadAudits,
    loadSftp,
    refreshBusy,
    refreshReachability,
    retryConnect,
    sftpProps.path,
    selectedId,
    selectedRedisId,
    setAuditOpen,
    setCurrentPage,
    tabs,
  ]);

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
        <CommandPaletteModal open={cmdkOpen} tr={tr} items={cmdkItems} onClose={() => setCmdkOpen(false)} />
      </main>
    </I18nProvider>
  );
}
