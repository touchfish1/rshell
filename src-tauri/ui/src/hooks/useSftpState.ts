import { useCallback, useEffect, useMemo, useState } from "react";
import { listSftpDir } from "../services/bridge";
import type { SftpEntry } from "../services/types";

function normalizeSftpPath(path?: string) {
  if (!path || path === ".") return "/";
  return path;
}

export function useSftpState(opts: {
  activeTabId?: string;
  tabs: Array<{ id: string; sessionId: string }>;
  connectedIds: string[];
  onError: (message: string) => void;
}) {
  const { activeTabId, tabs, connectedIds, onError } = opts;
  const [sftpEntriesMap, setSftpEntriesMap] = useState<Record<string, SftpEntry[]>>({});
  const [sftpPathMap, setSftpPathMap] = useState<Record<string, string>>({});
  const [sftpLoadingId, setSftpLoadingId] = useState<string | null>(null);

  const loadSftp = useCallback(
    async (tabId: string, sessionId: string, path?: string) => {
      setSftpLoadingId(tabId);
      try {
        const nextPath = normalizeSftpPath(path ?? sftpPathMap[tabId] ?? "/");
        const entries = await listSftpDir(sessionId, nextPath);
        setSftpEntriesMap((prev) => ({ ...prev, [tabId]: entries }));
        setSftpPathMap((prev) => ({ ...prev, [tabId]: nextPath }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        onError(`SFTP 列表读取失败: ${message}`);
      } finally {
        setSftpLoadingId((prev) => (prev === tabId ? null : prev));
      }
    },
    [onError, sftpPathMap]
  );

  useEffect(() => {
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;
    if (!connectedIds.includes(tab.sessionId)) return;
    if (sftpEntriesMap[activeTabId]) return;
    void loadSftp(activeTabId, tab.sessionId);
  }, [activeTabId, connectedIds, loadSftp, sftpEntriesMap, tabs]);

  const sftpProps = useMemo(() => {
    const entries = activeTabId ? sftpEntriesMap[activeTabId] ?? [] : [];
    const path = activeTabId ? sftpPathMap[activeTabId] ?? "/" : "/";
    const loading = Boolean(activeTabId && sftpLoadingId === activeTabId);
    return { entries, path, loading };
  }, [activeTabId, sftpEntriesMap, sftpLoadingId, sftpPathMap]);

  const sftpOpenDir = useCallback(
    (path: string) => {
      if (!activeTabId) return;
      const tab = tabs.find((t) => t.id === activeTabId);
      if (!tab) return;
      void loadSftp(activeTabId, tab.sessionId, path);
    },
    [activeTabId, loadSftp, tabs]
  );

  const sftpUp = useCallback(() => {
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;
    const current = normalizeSftpPath(sftpPathMap[activeTabId] ?? "/");
    if (current === "/") return;
    const normalized = current.replace(/\/+$/, "");
    const idx = normalized.lastIndexOf("/");
    const parent = idx <= 0 ? "/" : normalized.slice(0, idx);
    void loadSftp(activeTabId, tab.sessionId, parent);
  }, [activeTabId, loadSftp, sftpPathMap, tabs]);

  const clearTab = useCallback((tabId: string) => {
    setSftpEntriesMap((prev) => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
    setSftpPathMap((prev) => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
  }, []);

  return {
    sftpProps,
    loadSftp,
    sftpOpenDir,
    sftpUp,
    clearTab,
  };
}

