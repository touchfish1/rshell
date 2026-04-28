import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createEnvironment,
  downloadSftpFile,
  getCurrentEnvironment,
  listEnvironments,
  renameCurrentEnvironment,
  switchEnvironment,
  testZookeeperConnection,
  uploadSftpFile,
} from "../services/bridge";
import type {
  EtcdConnection,
  EtcdConnectionInput,
  MySqlConnection,
  RedisConnection,
  Session,
  ZookeeperConnection,
  ZookeeperConnectionInput,
} from "../services/types";
import type { DownloadTask } from "./useDownloadTasks";
import { useDownloadTasks } from "./useDownloadTasks";
import { useSessionPing } from "./useSessionPing";
import { useRedisActions } from "./useRedisActions";
import { useSessionActions } from "./useSessionActions";
import { useEtcdActions } from "./useEtcdActions";
import { useZookeeperActions } from "./useZookeeperActions";
import { useMysqlActions } from "./useMysqlActions";
import { useSftpState } from "./useSftpState";
import { useTerminalOutput } from "./useTerminalOutput";
import { useUpdater } from "./useUpdater";
import { useSystemTray } from "./useSystemTray";
import { useWorkspaceTabs } from "./useWorkspaceTabs";
import { useAuditLogs } from "./useAuditLogs";
import { useQuitConfirm } from "./useQuitConfirm";
import { detectInitialLang, setLangStorage, t, type I18nKey, type Lang } from "../i18n";

export function useAppShell() {
  const [lang, setLang] = useState<Lang>(() => detectInitialLang());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [currentPage, setCurrentPage] = useState<"home" | "terminal" | "zookeeper" | "redis" | "mysql" | "mysqlData" | "etcd">("home");
  const [zkConnections, setZkConnections] = useState<ZookeeperConnection[]>([]);
  const [redisConnections, setRedisConnections] = useState<RedisConnection[]>([]);
  const [selectedZkId, setSelectedZkId] = useState<string | undefined>();
  const [selectedRedisId, setSelectedRedisId] = useState<string | undefined>();
  const [mysqlConnections, setMysqlConnections] = useState<MySqlConnection[]>([]);
  const [selectedMysqlId, setSelectedMysqlId] = useState<string | undefined>();
  const [etcdConnections, setEtcdConnections] = useState<EtcdConnection[]>([]);
  const [selectedEtcdId, setSelectedEtcdId] = useState<string | undefined>();
  const [status, setStatus] = useState(() => t(detectInitialLang(), "status.idle"));
  const [error, setError] = useState<string | null>(null);
  const [environments, setEnvironments] = useState<string[]>(["default"]);
  const [currentEnvironment, setCurrentEnvironment] = useState("default");
  const [environmentBusy, setEnvironmentBusy] = useState(false);
  const [envReloadKey, setEnvReloadKey] = useState(0);
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

  useEffect(() => {
    void Promise.all([listEnvironments(), getCurrentEnvironment()])
      .then(([envs, current]) => {
        const next = envs.length > 0 ? envs : ["default"];
        setEnvironments(next);
        setCurrentEnvironment(current || next[0]);
      })
      .catch(() => {
        setEnvironments(["default"]);
        setCurrentEnvironment("default");
      });
  }, []);

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
    [createDownloadTask, finishDownloadTask, tr]
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
    if (currentPage !== "home" && currentPage !== "terminal") return;
    hookSetCurrentPage(currentPage);
  }, [currentPage, hookSetCurrentPage]);

  useEffect(() => {
    hookSetActiveTabId(activeTabId);
  }, [activeTabId, hookSetActiveTabId]);

  useEffect(() => {
    // 仅在「终端页因内部状态回退到首页」时回写，避免点击返回时 home/terminal 来回抖动。
    if (currentPage === "terminal" && hookCurrentPage === "home") {
      setCurrentPage("home");
    }
  }, [currentPage, hookCurrentPage]);

  useEffect(() => {
    setActiveTabId(hookActiveTabId);
  }, [hookActiveTabId]);

  const { reachabilityMap, refreshBusy, refreshReachability } = useSessionPing({ currentPage, sessions });

  const writeToTab = useMemo(() => {
    return (tabId: string, text: string) => writerMapRef.current.get(tabId)?.(text);
  }, []);

  const refreshByEnvironmentSwitch = useCallback(() => {
    setSelectedId(undefined);
    setSelectedZkId(undefined);
    setSelectedRedisId(undefined);
    setSelectedMysqlId(undefined);
    setSelectedEtcdId(undefined);
    setEnvReloadKey((v) => v + 1);
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
    reloadKey: envReloadKey,
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
    reloadKey: envReloadKey,
  });

  const {
    create: createRedis,
    update: updateRedis,
    remove: removeRedis,
    getSecret: getRedisSecret,
  } = useRedisActions({
    connections: redisConnections,
    setConnections: setRedisConnections,
    selectedId: selectedRedisId,
    setSelectedId: setSelectedRedisId,
    setStatus,
    setError,
    tr,
    reloadKey: envReloadKey,
  });

  const {
    create: createMysql,
    update: updateMysql,
    remove: removeMysql,
    getSecret: getMysqlSecret,
  } = useMysqlActions({
    connections: mysqlConnections,
    setConnections: setMysqlConnections,
    selectedId: selectedMysqlId,
    setSelectedId: setSelectedMysqlId,
    setStatus,
    setError,
    tr,
    reloadKey: envReloadKey,
  });

  const {
    create: createEtcd,
    update: updateEtcd,
    remove: removeEtcd,
    getSecret: getEtcdSecret,
  } = useEtcdActions({
    connections: etcdConnections,
    setConnections: setEtcdConnections,
    selectedId: selectedEtcdId,
    setSelectedId: setSelectedEtcdId,
    setStatus,
    setError,
    tr,
    reloadKey: envReloadKey,
  });

  const testZkConnection = useCallback(async (input: ZookeeperConnectionInput, secret?: string) => {
    await testZookeeperConnection(input.connect_string, input.session_timeout_ms, secret);
  }, []);

  const connectWithPageSwitch = useCallback(
    async (id?: string) => {
      // App 层 page 状态与 workspace page 状态已解耦，连接时显式切页避免“点击无反应”。
      setCurrentPage("terminal");
      await connect(id);
    },
    [connect]
  );

  const switchCurrentEnvironment = useCallback(
    async (name: string) => {
      setEnvironmentBusy(true);
      try {
        const next = await switchEnvironment(name);
        setCurrentEnvironment(next);
        const envs = await listEnvironments();
        setEnvironments(envs.length > 0 ? envs : [next]);
        refreshByEnvironmentSwitch();
        setStatus(tr("status.environmentSwitched", { name: next }));
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(tr("error.switchEnvironmentFailed", { message }));
      } finally {
        setEnvironmentBusy(false);
      }
    },
    [refreshByEnvironmentSwitch, tr]
  );

  const createAndSwitchEnvironment = useCallback(
    async (name: string) => {
      setEnvironmentBusy(true);
      try {
        const envs = await createEnvironment(name);
        const next = await switchEnvironment(name);
        setEnvironments(envs.length > 0 ? envs : [next]);
        setCurrentEnvironment(next);
        refreshByEnvironmentSwitch();
        setStatus(tr("status.environmentCreated", { name: next }));
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(tr("error.createEnvironmentFailed", { message }));
      } finally {
        setEnvironmentBusy(false);
      }
    },
    [refreshByEnvironmentSwitch, tr]
  );

  const renameEnvironment = useCallback(
    async (newName: string) => {
      setEnvironmentBusy(true);
      try {
        const next = await renameCurrentEnvironment(newName);
        setCurrentEnvironment(next);
        const envs = await listEnvironments();
        setEnvironments(envs.length > 0 ? envs : [next]);
        refreshByEnvironmentSwitch();
        setStatus(tr("status.environmentRenamed", { name: next }));
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(tr("error.renameEnvironmentFailed", { message }));
      } finally {
        setEnvironmentBusy(false);
      }
    },
    [refreshByEnvironmentSwitch, tr]
  );

  return {
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
    status,
    error,
    setError,
    tabs,
    activeTabId,
    setActiveTabId,
    connectedIds,
    connectingHostId,
    writerMapRef,
    terminals,
    sftpProps,
    sftpOpenDir,
    sftpUp,
    loadSftp,
    connect: connectWithPageSwitch,
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
  };
}
