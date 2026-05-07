import { useMemo } from "react";
import type { I18nKey } from "../i18n";
import type { CommandPaletteItem } from "../components/CommandPaletteModal";

interface Deps {
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  currentPage: "home" | "terminal" | "zookeeper" | "redis" | "mysql" | "mysqlData" | "etcd";
  setCurrentPage: (page: "home" | "terminal" | "zookeeper" | "redis" | "mysql" | "mysqlData" | "etcd") => void;
  refreshBusy: boolean;
  refreshReachability: () => void;
  setAuditOpen: (open: boolean) => void;
  loadAudits: () => Promise<void> | void;
  activeTabId?: string;
  disconnect: (id: string) => void;
  closeTab: (id: string) => void;
  retryConnect: (id: string) => void;
  tabs: Array<{ id: string; sessionId: string }>;
  loadSftp: (tabId: string, sessionId: string, path: string) => Promise<void> | void;
  sftpPath: string;
  selectedRedisId?: string;
  selectedId?: string;
  connect: (id: string) => Promise<void> | void;
}

export function useCommandPaletteItems(deps: Deps): { cmdkItems: CommandPaletteItem[] } {
  const {
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
    sftpPath,
    selectedRedisId,
    selectedId,
    connect,
  } = deps;

  const cmdkItems = useMemo<CommandPaletteItem[]>(() => {
    const items: CommandPaletteItem[] = [];

    items.push({
      id: "nav:home",
      label: tr("commandPalette.navHome"),
      keywords: ["home", "首页", "返回"],
      run: () => setCurrentPage("home"),
    });
    items.push({
      id: "nav:terminal",
      label: tr("commandPalette.navTerminal"),
      keywords: ["terminal", "终端", "host"],
      run: () => setCurrentPage("terminal"),
    });
    items.push({
      id: "nav:zookeeper",
      label: tr("commandPalette.navZookeeper"),
      keywords: ["zk", "zookeeper", "zoo", "zookeeper页"],
      run: () => setCurrentPage("zookeeper"),
    });
    items.push({
      id: "nav:redis",
      label: tr("commandPalette.navRedis"),
      keywords: ["redis", "cache", "kv", "redis页"],
      run: () => setCurrentPage("redis"),
    });
    items.push({
      id: "nav:mysql",
      label: tr("commandPalette.navMysql"),
      keywords: ["mysql", "sql", "database", "mysql页"],
      run: () => setCurrentPage("mysql"),
    });
    items.push({
      id: "nav:etcd",
      label: tr("commandPalette.navEtcd"),
      keywords: ["etcd", "kv", "key-value", "etcd页"],
      run: () => setCurrentPage("etcd"),
    });

    if (currentPage === "home") {
      items.push({
        id: "home:refreshReachability",
        label: tr("commandPalette.homeRefresh"),
        keywords: ["刷新", "状态", "ping", "reachability"],
        disabled: refreshBusy,
        hint: refreshBusy ? tr("commandPalette.homeRefreshBusyHint") : undefined,
        run: () => refreshReachability(),
      });
      items.push({
        id: "home:audit",
        label: tr("commandPalette.homeAudit"),
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
        label: tr("commandPalette.terminalDisconnect"),
        keywords: ["disconnect", "断开", "close"],
        disabled: !activeTabId,
        run: () => {
          if (activeTabId) disconnect(activeTabId);
        },
      });
      items.push({
        id: "terminal:closeTab",
        label: tr("commandPalette.terminalCloseTab"),
        keywords: ["tab", "close", "关闭标签"],
        disabled: !activeTabId,
        run: () => {
          if (activeTabId) closeTab(activeTabId);
        },
      });
      items.push({
        id: "terminal:retry",
        label: tr("commandPalette.terminalRetry"),
        keywords: ["retry", "重试", "reconnect"],
        disabled: !activeTabId,
        run: () => {
          if (activeTabId) retryConnect(activeTabId);
        },
      });
      items.push({
        id: "terminal:sftpReload",
        label: tr("commandPalette.terminalSftpReload"),
        keywords: ["sftp", "refresh", "刷新文件"],
        disabled: !activeTabId,
        run: () => {
          if (!activeTabId) return;
          const tab = tabs.find((t) => t.id === activeTabId);
          if (!tab) return;
          void loadSftp(activeTabId, tab.sessionId, sftpPath);
        },
      });
    }

    if (currentPage === "redis") {
      items.push({
        id: "redis:disconnect",
        label: tr("commandPalette.redisDisconnect"),
        keywords: ["redis", "disconnect", "断开"],
        disabled: !selectedRedisId,
        run: () => {
          if (!selectedRedisId) return;
          setCurrentPage("redis");
        },
      });
    }

    items.push({
      id: "host:connectSelected",
      label: tr("commandPalette.connectSelected"),
      keywords: ["connect", "连接", "ssh", "telnet"],
      disabled: !selectedId,
      run: async () => {
        if (!selectedId) return;
        await connect(selectedId);
      },
    });

    return items;
  }, [
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
    sftpPath,
    selectedRedisId,
    selectedId,
    connect,
  ]);

  return { cmdkItems };
}
