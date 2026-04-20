import { useEffect, useRef } from "react";
import type { WorkspaceTab } from "../../services/types";

function isBlockingOverlayFocused(): boolean {
  const el = document.activeElement;
  if (!el || !(el instanceof HTMLElement)) return false;
  return Boolean(el.closest(".modal-backdrop, .sftp-editor-mask"));
}

function isTerminalInputFocused(): boolean {
  const el = document.activeElement;
  if (!el || !(el instanceof HTMLElement)) return false;
  return Boolean(el.closest(".xterm"));
}

interface UseTerminalShortcutsArgs {
  tabs: WorkspaceTab[];
  activeTabId?: string;
  editHostOpen: boolean;
  shortcutHelpOpen: boolean;
  onSetShortcutHelpOpen: (open: boolean) => void;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string) => void;
}

export function useTerminalShortcuts({
  tabs,
  activeTabId,
  editHostOpen,
  shortcutHelpOpen,
  onSetShortcutHelpOpen,
  onSwitchTab,
  onCloseTab,
}: UseTerminalShortcutsArgs) {
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);
  const shortcutHelpOpenRef = useRef(shortcutHelpOpen);
  tabsRef.current = tabs;
  activeTabIdRef.current = activeTabId;
  shortcutHelpOpenRef.current = shortcutHelpOpen;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isCtrlSlash = e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "/" || e.code === "Slash");
      if (isCtrlSlash && shortcutHelpOpenRef.current) {
        e.preventDefault();
        onSetShortcutHelpOpen(false);
        return;
      }
      if (editHostOpen) return;
      if (isBlockingOverlayFocused()) return;

      if (isCtrlSlash) {
        if (isTerminalInputFocused()) return;
        e.preventDefault();
        onSetShortcutHelpOpen(true);
        return;
      }

      const list = tabsRef.current;
      if (list.length === 0) return;

      if (e.ctrlKey && !e.metaKey && !e.altKey && e.key === "Tab") {
        e.preventDefault();
        const delta = e.shiftKey ? -1 : 1;
        let idx = activeTabIdRef.current ? list.findIndex((t) => t.id === activeTabIdRef.current) : 0;
        if (idx < 0) idx = 0;
        const next = (idx + delta + list.length) % list.length;
        onSwitchTab(list[next].id);
        return;
      }

      if (e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "w" || e.key === "W")) {
        const id = activeTabIdRef.current;
        if (!id) return;
        const closeViaShortcut = e.shiftKey || !isTerminalInputFocused();
        if (!closeViaShortcut) return;
        e.preventDefault();
        onCloseTab(id);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [editHostOpen, onCloseTab, onSetShortcutHelpOpen, onSwitchTab]);
}

