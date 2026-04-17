import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { connectSession, disconnectSession, updateSession } from "../services/bridge";
import type { Session, SessionInput } from "../services/types";
import type { I18nKey } from "../i18n";

interface TerminalTab {
  id: string;
  sessionId: string;
  title: string;
}

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
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [currentPage, setCurrentPage] = useState<"home" | "terminal">("home");

  const tabsRef = useRef<TerminalTab[]>([]);
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  const getTabsBySessionId = useCallback((sessionId: string) => {
    return tabsRef.current.filter((tab) => tab.sessionId === sessionId);
  }, []);

  const connect = useCallback(
    async (id?: string) => {
      const sessionId = id ?? selectedId;
      if (!sessionId) return;
      const targetSession = sessions.find((session) => session.id === sessionId);
      const index = tabsRef.current.filter((tab) => tab.sessionId === sessionId).length + 1;
      const tabId = `${sessionId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const tabTitle = `${targetSession?.name ?? sessionId}${index > 1 ? ` (${index})` : ""}`;

      setTabs((prev) => [...prev, { id: tabId, sessionId, title: tabTitle }]);
      setActiveTabId(tabId);
      setCurrentPage("terminal");
      setStatus(tr("status.connecting", { name: targetSession?.name ?? sessionId }));
      setError(null);

      const rollbackTab = () => {
        setTabs((prev) => prev.filter((tab) => tab.id !== tabId));
        setActiveTabId((prev) => (prev === tabId ? undefined : prev));
        writerMapRef.current.delete(tabId);
        clearSftpTab(tabId);
      };

      if (connectedIds.includes(sessionId)) {
        setStatus(tr("status.connected", { name: targetSession?.name ?? sessionId }));
        void loadSftp(tabId, sessionId, "/");
        return;
      }

      try {
        await connectSession(sessionId);
        setConnectedIds((prev) => (prev.includes(sessionId) ? prev : [...prev, sessionId]));
        setStatus(tr("status.connected", { name: targetSession?.name ?? sessionId }));
        void loadSftp(tabId, sessionId, "/");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("missing SSH password")) {
          const input = window.prompt(tr("prompt.inputSshPassword"));
          if (!input) {
            setError(tr("error.connectMissingPassword"));
            rollbackTab();
            return;
          }
          try {
            if (targetSession) {
              const sessionInput: SessionInput = {
                name: targetSession.name,
                protocol: targetSession.protocol,
                host: targetSession.host,
                port: targetSession.port,
                username: targetSession.username,
                encoding: targetSession.encoding,
                keepalive_secs: targetSession.keepalive_secs,
              };
              await updateSession(sessionId, sessionInput, input);
            }
            await connectSession(sessionId, input);
            setConnectedIds((prev) => (prev.includes(sessionId) ? prev : [...prev, sessionId]));
            setStatus(tr("status.connected", { name: targetSession?.name ?? sessionId }));
            setError(null);
            void loadSftp(tabId, sessionId, "/");
            return;
          } catch (retryErr) {
            const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
            setError(tr("error.connectFailed", { message: retryMsg }));
            rollbackTab();
            return;
          }
        }
        setError(tr("error.connectFailed", { message }));
        rollbackTab();
      }
    },
    [clearSftpTab, connectedIds, loadSftp, selectedId, sessions, setError, setStatus, tr, writerMapRef]
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
    disconnect,
    closeTab,
    duplicateTab,
    closeTabsToLeft,
    closeTabsToRight,
    closeOtherTabs,
    getTabsBySessionId,
    onBackToHome,
  };
}

