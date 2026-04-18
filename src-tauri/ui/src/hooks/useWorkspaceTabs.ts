/**
 * 工作区标签与会话连接：`tabs`/`activeTabId`、连接/断开、`pull_output` 失败处理、SFTP 页与重试。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { connectSession, disconnectSession } from "../services/bridge";
import type { Session, WorkspaceTab } from "../services/types";
import type { I18nKey } from "../i18n";
import { touchRecentSession } from "../lib/recentSessions";
import { tryConnectSessionWithPasswordPrompt } from "../lib/tryConnectSessionWithPasswordPrompt";
import { buildWorkspaceTabId, formatTabTitle, nextTabIndexForSession } from "../lib/workspaceTabIds";

export function useWorkspaceTabs(opts: {
  sessions: Session[];
  selectedId?: string;
  writerMapRef: React.MutableRefObject<Map<string, (content: string) => void>>;
  setStatus: (text: string) => void;
  setError: (text: string | null) => void;
  loadSftp: (tabId: string, sessionId: string, path?: string) => Promise<void> | void;
  clearSftpTab: (tabId: string) => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}) {
  const { sessions, selectedId, writerMapRef, setStatus, setError, loadSftp, clearSftpTab, tr } = opts;

  const [connectedIds, setConnectedIds] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | undefined>();
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [currentPage, setCurrentPage] = useState<"home" | "terminal">("home");
  /** 首页/侧栏用于显示「该主机正在握手连接」 */
  const [connectingHostId, setConnectingHostId] = useState<string | null>(null);

  const tabsRef = useRef<WorkspaceTab[]>([]);
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  const getTabsBySessionId = useCallback((sessionId: string) => {
    return tabsRef.current.filter((tab) => tab.sessionId === sessionId);
  }, []);

  const markTabFailed = useCallback((tabId: string, message: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, linkState: "failed" as const, linkError: message } : t))
    );
    setError(message);
  }, [setError]);

  const markSessionTabsFailed = useCallback((sessionId: string, message: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.sessionId === sessionId ? { ...t, linkState: "failed" as const, linkError: message } : t
      )
    );
    setError(message);
  }, [setError]);

  const handlePullOutputFailure = useCallback(
    (sessionId: string, message: string) => {
      setConnectedIds((prev) => prev.filter((id) => id !== sessionId));
      void disconnectSession(sessionId).catch(() => {});
      markSessionTabsFailed(sessionId, tr("terminal.sessionInterrupted", { message }));
      setStatus(tr("status.sessionInterrupted"));
    },
    [markSessionTabsFailed, setStatus, tr]
  );

  const connect = useCallback(
    async (id?: string) => {
      const sessionId = id ?? selectedId;
      if (!sessionId) return;
      const targetSession = sessions.find((session) => session.id === sessionId);
      const index = nextTabIndexForSession(tabsRef.current.filter((tab) => tab.sessionId === sessionId).length);
      const tabId = buildWorkspaceTabId(sessionId);
      const tabTitle = formatTabTitle(targetSession?.name, sessionId, index);
      const alreadyConnected = connectedIds.includes(sessionId);

      setTabs((prev) => [
        ...prev,
        {
          id: tabId,
          sessionId,
          title: tabTitle,
          linkState: alreadyConnected ? "ready" : "connecting",
        },
      ]);
      setActiveTabId(tabId);
      setCurrentPage("terminal");
      setStatus(
        alreadyConnected
          ? tr("status.connected", { name: targetSession?.name ?? sessionId })
          : tr("status.connecting", { name: targetSession?.name ?? sessionId })
      );
      setError(null);

      const rollbackTab = () => {
        setTabs((prev) => prev.filter((tab) => tab.id !== tabId));
        setActiveTabId((prev) => (prev === tabId ? undefined : prev));
        writerMapRef.current.delete(tabId);
        clearSftpTab(tabId);
      };

      if (alreadyConnected) {
        void loadSftp(tabId, sessionId, "/");
        return;
      }

      const finishOk = () => {
        touchRecentSession(sessionId);
        setConnectedIds((prev) => (prev.includes(sessionId) ? prev : [...prev, sessionId]));
        setTabs((prev) =>
          prev.map((t) =>
            t.sessionId === sessionId ? { ...t, linkState: "ready" as const, linkError: undefined } : t
          )
        );
        setStatus(tr("status.connected", { name: targetSession?.name ?? sessionId }));
        setError(null);
        void loadSftp(tabId, sessionId, "/");
      };

      setConnectingHostId(sessionId);
      try {
        const ok = await tryConnectSessionWithPasswordPrompt({
          sessionId,
          targetSession,
          tr,
          fail: (msg) => markTabFailed(tabId, msg),
          onPasswordPromptCancelled: () => {
            setError(tr("error.connectMissingPassword"));
            rollbackTab();
          },
        });
        if (ok) finishOk();
      } finally {
        setConnectingHostId(null);
      }
    },
    [
      clearSftpTab,
      connectedIds,
      loadSftp,
      markTabFailed,
      selectedId,
      sessions,
      setError,
      setStatus,
      tr,
      writerMapRef,
    ]
  );

  const retryConnect = useCallback(
    async (tabId: string) => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (!tab || tab.linkState !== "failed") return;
      const sessionId = tab.sessionId;
      const targetSession = sessions.find((s) => s.id === sessionId);
      setTabs((prev) =>
        prev.map((t) =>
          t.sessionId === sessionId ? { ...t, linkState: "connecting" as const, linkError: undefined } : t
        )
      );
      setStatus(tr("status.connecting", { name: targetSession?.name ?? sessionId }));
      setError(null);

      setConnectingHostId(sessionId);
      try {
        if (connectedIds.includes(sessionId)) {
          try {
            await disconnectSession(sessionId);
          } catch {
            /* ignore */
          }
          setConnectedIds((prev) => prev.filter((id) => id !== sessionId));
        }

        const finishOk = () => {
          touchRecentSession(sessionId);
          setConnectedIds((prev) => (prev.includes(sessionId) ? prev : [...prev, sessionId]));
          setTabs((prev) =>
            prev.map((t) =>
              t.sessionId === sessionId ? { ...t, linkState: "ready" as const, linkError: undefined } : t
            )
          );
          setStatus(tr("status.connected", { name: targetSession?.name ?? sessionId }));
          setError(null);
          void loadSftp(tabId, sessionId, "/");
        };

        const ok = await tryConnectSessionWithPasswordPrompt({
          sessionId,
          targetSession,
          tr,
          fail: (msg) => markTabFailed(tabId, msg),
          onPasswordPromptCancelled: () => markTabFailed(tabId, tr("error.connectMissingPassword")),
        });
        if (ok) finishOk();
      } finally {
        setConnectingHostId(null);
      }
    },
    [connectedIds, loadSftp, markTabFailed, sessions, setError, setStatus, tr]
  );

  const disconnect = useCallback(
    async (id?: string) => {
      const targetTabId = id ?? activeTabId;
      if (!targetTabId) return;
      const currentTabs = tabsRef.current;
      const targetIndex = currentTabs.findIndex((tab) => tab.id === targetTabId);
      const targetTab = currentTabs.find((tab) => tab.id === targetTabId);
      if (!targetTab) return;
      try {
        const remainTabsSameSession = currentTabs.filter(
          (tab) => tab.sessionId === targetTab.sessionId && tab.id !== targetTab.id
        );
        const nextTabs = currentTabs.filter((tab) => tab.id !== targetTab.id);
        if (remainTabsSameSession.length === 0 && connectedIds.includes(targetTab.sessionId)) {
          await disconnectSession(targetTab.sessionId);
          setConnectedIds((prev) => prev.filter((sid) => sid !== targetTab.sessionId));
        }
        tabsRef.current = nextTabs;
        setTabs(nextTabs);
        writerMapRef.current.delete(targetTab.id);
        clearSftpTab(targetTab.id);
        const nextActiveId =
          targetIndex > 0
            ? nextTabs[targetIndex - 1]?.id
            : nextTabs[targetIndex]?.id ?? nextTabs[nextTabs.length - 1]?.id;
        setActiveTabId((prev) => {
          if (prev !== targetTab.id) return prev;
          return nextActiveId;
        });
        if (nextTabs.length === 0) {
          setCurrentPage("home");
        }
        setStatus(tr("status.disconnected"));
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(tr("error.disconnectFailed", { message }));
      }
    },
    [activeTabId, clearSftpTab, connectedIds, setError, setStatus, tr, writerMapRef]
  );

  const duplicateTab = useCallback(
    async (id: string) => {
      const tab = tabsRef.current.find((item) => item.id === id);
      if (!tab) return;
      await connect(tab.sessionId);
    },
    [connect]
  );

  const closeTabsBatch = useCallback(
    async (tabIds: string[]) => {
      for (const tabId of tabIds) {
        await disconnect(tabId);
      }
    },
    [disconnect]
  );

  const closeTabsToLeft = useCallback(
    async (id: string) => {
      const current = tabsRef.current;
      const index = current.findIndex((tab) => tab.id === id);
      if (index <= 0) return;
      const targets = current.slice(0, index).map((tab) => tab.id);
      await closeTabsBatch(targets);
    },
    [closeTabsBatch]
  );

  const closeTabsToRight = useCallback(
    async (id: string) => {
      const current = tabsRef.current;
      const index = current.findIndex((tab) => tab.id === id);
      if (index < 0 || index === current.length - 1) return;
      const targets = current.slice(index + 1).map((tab) => tab.id);
      await closeTabsBatch(targets);
    },
    [closeTabsBatch]
  );

  const closeOtherTabs = useCallback(
    async (id: string) => {
      const current = tabsRef.current;
      const targets = current.filter((tab) => tab.id !== id).map((tab) => tab.id);
      await closeTabsBatch(targets);
    },
    [closeTabsBatch]
  );

  const closeTab = useCallback(async (id: string) => disconnect(id), [disconnect]);

  const onBackToHome = useCallback(() => setCurrentPage("home"), []);

  const terminals = useMemo(() => tabs.map((tab) => ({ id: tab.id, sessionId: tab.sessionId })), [tabs]);

  return {
    connectedIds,
    setConnectedIds,
    tabs,
    terminals,
    activeTabId,
    setActiveTabId,
    currentPage,
    setCurrentPage,
    connect,
    retryConnect,
    disconnect,
    closeTab,
    duplicateTab,
    closeTabsToLeft,
    closeTabsToRight,
    closeOtherTabs,
    getTabsBySessionId,
    onBackToHome,
    handlePullOutputFailure,
    connectingHostId,
  };
}
