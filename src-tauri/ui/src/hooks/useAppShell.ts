import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { downloadSftpFile, testZookeeperConnection, uploadSftpFile } from "../services/bridge";
import type {
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
import { useZookeeperActions } from "./useZookeeperActions";
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
  const [currentPage, setCurrentPage] = useState<"home" | "terminal" | "zookeeper" | "redis">("home");
  const [zkConnections, setZkConnections] = useState<ZookeeperConnection[]>([]);
  const [redisConnections, setRedisConnections] = useState<RedisConnection[]>([]);
  const [selectedZkId, setSelectedZkId] = useState<string | undefined>();
  const [selectedRedisId, setSelectedRedisId] = useState<string | undefined>();
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
    if (currentPage !== "home" && currentPage !== "terminal") return;
    setCurrentPage(hookCurrentPage);
  }, [currentPage, hookCurrentPage]);

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
  });

  const testZkConnection = useCallback(async (input: ZookeeperConnectionInput, secret?: string) => {
    await testZookeeperConnection(input.connect_string, input.session_timeout_ms, secret);
  }, []);

  return {
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
    terminals,
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
  };
}
