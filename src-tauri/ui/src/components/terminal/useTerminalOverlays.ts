import { useCallback, useEffect, useState } from "react";
import type { Terminal } from "xterm";

interface UseTerminalOverlaysArgs {
  getTerminal: () => Terminal | null;
  pasteFromClipboard: (terminal: Terminal) => void;
}

export function useTerminalOverlays({ getTerminal, pasteFromClipboard }: UseTerminalOverlaysArgs) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const timer = window.setTimeout(() => {
      window.addEventListener("click", close);
    }, 0);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [ctxMenu]);

  const runCtxCopy = useCallback(() => {
    const terminal = getTerminal();
    if (!terminal?.hasSelection()) return;
    void navigator.clipboard.writeText(terminal.getSelection()).catch(() => {});
    setCtxMenu(null);
  }, [getTerminal]);

  const runCtxPaste = useCallback(() => {
    const terminal = getTerminal();
    if (!terminal) return;
    pasteFromClipboard(terminal);
    setCtxMenu(null);
  }, [getTerminal, pasteFromClipboard]);

  const runCtxSelectAll = useCallback(() => {
    getTerminal()?.selectAll();
    setCtxMenu(null);
  }, [getTerminal]);

  return {
    ctxMenu,
    setCtxMenu,
    runCtxCopy,
    runCtxPaste,
    runCtxSelectAll,
  };
}

