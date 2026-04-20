import { useCallback } from "react";
import type { WorkspaceTab } from "../../services/types";

export function useWorkspaceBatchClose(opts: {
  tabsRef: React.MutableRefObject<WorkspaceTab[]>;
  disconnectTab: (tabId: string) => Promise<void>;
}) {
  const { tabsRef, disconnectTab } = opts;

  const closeTabsBatch = useCallback(
    async (tabIds: string[]) => {
      for (const tabId of tabIds) {
        await disconnectTab(tabId);
      }
    },
    [disconnectTab]
  );

  const closeTabsToLeft = useCallback(
    async (id: string) => {
      const current = tabsRef.current;
      const index = current.findIndex((tab) => tab.id === id);
      if (index <= 0) return;
      const targets = current.slice(0, index).map((tab) => tab.id);
      await closeTabsBatch(targets);
    },
    [closeTabsBatch, tabsRef]
  );

  const closeTabsToRight = useCallback(
    async (id: string) => {
      const current = tabsRef.current;
      const index = current.findIndex((tab) => tab.id === id);
      if (index < 0 || index === current.length - 1) return;
      const targets = current.slice(index + 1).map((tab) => tab.id);
      await closeTabsBatch(targets);
    },
    [closeTabsBatch, tabsRef]
  );

  const closeOtherTabs = useCallback(
    async (id: string) => {
      const current = tabsRef.current;
      const targets = current.filter((tab) => tab.id !== id).map((tab) => tab.id);
      await closeTabsBatch(targets);
    },
    [closeTabsBatch, tabsRef]
  );

  return { closeTabsToLeft, closeTabsToRight, closeOtherTabs };
}

