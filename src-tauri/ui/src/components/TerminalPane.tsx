import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import type { TabLinkState } from "../services/types";
import { useI18n } from "../i18n-context";
import { TerminalPaneContextMenu } from "./terminal/TerminalPaneContextMenu";
import { TerminalPaneLinkOverlay } from "./terminal/TerminalPaneLinkOverlay";
import {
  adjustTerminalFontSize,
  getTerminalFontSize,
  persistTerminalFontSize,
  TERMINAL_FONT_DEFAULT,
  TERMINAL_FONT_MAX,
  TERMINAL_FONT_MIN,
} from "../lib/terminalFontSize";

interface Props {
  isActive: boolean;
  connected: boolean;
  linkState?: TabLinkState;
  linkError?: string;
  onRetryConnect?: () => void;
  onCloseFailedTab?: () => void;
  onInput: (text: string) => void;
  onResize: (cols: number, rows: number) => void;
  registerWriter: (writer: (content: string) => void) => void;
}

export default function TerminalPane({
  isActive,
  connected,
  linkState = "ready",
  linkError,
  onRetryConnect,
  onCloseFailedTab,
  onInput,
  onResize,
  registerWriter,
}: Props) {
  const { tr } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const connectedRef = useRef(connected);
  const activeRef = useRef(isActive);
  const onInputRef = useRef(onInput);
  const onResizeRef = useRef(onResize);
  const registerWriterRef = useRef(registerWriter);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastResizeRef = useRef<{ cols: number; rows: number; at: number }>({ cols: 0, rows: 0, at: 0 });
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  const pasteFromClipboard = useCallback((terminal: Terminal) => {
    void navigator.clipboard
      .readText()
      .then((text) => {
        if (text.length > 0) {
          terminal.paste(text);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);

  useEffect(() => {
    activeRef.current = isActive;
    if (!isActive) return;
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon) return;
    const resync = () => {
      fitAddon.fit();
      if (terminal.rows > 0) {
        terminal.refresh(0, terminal.rows - 1);
      }
      terminal.scrollToBottom();
      terminal.focus();
      const now = Date.now();
      const last = lastResizeRef.current;
      if (terminal.cols === last.cols && terminal.rows === last.rows && now - last.at < 400) return;
      lastResizeRef.current = { cols: terminal.cols, rows: terminal.rows, at: now };
      onResizeRef.current(terminal.cols, terminal.rows);
    };
    let raf2 = 0;
    let t1 = 0;
    let t2 = 0;
    let t3 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      resync();
      raf2 = window.requestAnimationFrame(resync);
      t1 = window.setTimeout(resync, 60);
      t2 = window.setTimeout(resync, 160);
      t3 = window.setTimeout(resync, 320);
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
      if (t1) window.clearTimeout(t1);
      if (t2) window.clearTimeout(t2);
      if (t3) window.clearTimeout(t3);
    };
  }, [isActive]);

  useEffect(() => {
    onInputRef.current = onInput;
  }, [onInput]);

  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  useEffect(() => {
    registerWriterRef.current = registerWriter;
  }, [registerWriter]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: getTerminalFontSize(),
      theme: { background: "#101219" },
    });
    const fitAddon = new FitAddon();
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);

    const tryPaste = (event: KeyboardEvent) => {
      const isModV =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        (event.key === "v" || event.key === "V" || event.code === "KeyV");
      const isCtrlShiftV =
        event.type === "keydown" &&
        event.ctrlKey &&
        event.shiftKey &&
        !event.metaKey &&
        !event.altKey &&
        (event.key === "V" || event.key === "v" || event.code === "KeyV");
      const isShiftInsert =
        event.key === "Insert" && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;

      if (isCtrlShiftV || (isModV && !event.shiftKey) || isShiftInsert) {
        event.preventDefault();
        pasteFromClipboard(terminal);
        return false;
      }
      return true;
    };

    const syncPaneHeight = () => {
      const pane = containerRef.current;
      const parent = pane?.parentElement;
      if (!pane || !parent) return;
      const height = parent.clientHeight;
      if (height > 0) {
        pane.style.height = `${height}px`;
      }
    };

    const onWindowResize = () => {
      syncPaneHeight();
      fitAddon.fit();
      if (activeRef.current) {
        const now = Date.now();
        const last = lastResizeRef.current;
        if (terminal.cols === last.cols && terminal.rows === last.rows && now - last.at < 400) return;
        lastResizeRef.current = { cols: terminal.cols, rows: terminal.rows, at: now };
        onResizeRef.current(terminal.cols, terminal.rows);
      }
    };

    const applyFontSize = (raw: number) => {
      const next = Math.max(TERMINAL_FONT_MIN, Math.min(TERMINAL_FONT_MAX, Math.round(raw)));
      persistTerminalFontSize(next);
      terminal.options.fontSize = next;
      onWindowResize();
    };

    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type === "keydown" && event.key === "Tab") {
        event.preventDefault();
        return true;
      }
      if (event.type === "keydown" && (event.ctrlKey || event.metaKey) && !event.altKey) {
        const code = event.code;
        if (code === "Equal" || code === "NumpadAdd") {
          event.preventDefault();
          applyFontSize(
            adjustTerminalFontSize(terminal.options.fontSize ?? TERMINAL_FONT_DEFAULT, 1)
          );
          return false;
        }
        if (code === "Minus" || code === "NumpadSubtract") {
          event.preventDefault();
          applyFontSize(
            adjustTerminalFontSize(terminal.options.fontSize ?? TERMINAL_FONT_DEFAULT, -1)
          );
          return false;
        }
        if (code === "Digit0" || code === "Numpad0") {
          event.preventDefault();
          applyFontSize(TERMINAL_FONT_DEFAULT);
          return false;
        }
      }
      if (event.type === "keydown") {
        const pasted = tryPaste(event);
        if (!pasted) return false;
      }
      if (
        event.type === "keydown" &&
        event.ctrlKey &&
        event.shiftKey &&
        !event.metaKey &&
        !event.altKey &&
        (event.key === "c" || event.key === "C" || event.code === "KeyC") &&
        terminal.hasSelection()
      ) {
        void navigator.clipboard.writeText(terminal.getSelection()).catch(() => {});
        event.preventDefault();
        return false;
      }
      if (
        event.type === "keydown" &&
        event.metaKey &&
        event.shiftKey &&
        !event.ctrlKey &&
        !event.altKey &&
        (event.key === "c" || event.key === "C" || event.code === "KeyC") &&
        terminal.hasSelection()
      ) {
        void navigator.clipboard.writeText(terminal.getSelection()).catch(() => {});
        event.preventDefault();
        return false;
      }
      if (
        event.type === "keydown" &&
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        (event.key === "c" || event.key === "C" || event.code === "KeyC") &&
        terminal.hasSelection()
      ) {
        void navigator.clipboard.writeText(terminal.getSelection()).catch(() => {});
        event.preventDefault();
        return false;
      }
      return true;
    });
    fitAddon.fit();
    terminal.focus();

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      setCtxMenu({ x: event.clientX, y: event.clientY });
    };
    terminal.element?.addEventListener("contextmenu", onContextMenu);

    const onWheelZoom = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1;
      applyFontSize(
        adjustTerminalFontSize(terminal.options.fontSize ?? TERMINAL_FONT_DEFAULT, delta)
      );
    };
    terminal.element?.addEventListener("wheel", onWheelZoom, { passive: false });
    let fitScheduled = false;
    const scheduleFit = () => {
      if (fitScheduled) return;
      fitScheduled = true;
      window.requestAnimationFrame(() => {
        fitScheduled = false;
        onWindowResize();
      });
    };

    registerWriterRef.current((content) => {
      terminal.write(content);
      if (connectedRef.current) {
        scheduleFit();
      }
    });

    const disposeInput = terminal.onData((value) => {
      if (!connectedRef.current) {
        terminal.write(value);
      }
      if (connectedRef.current) {
        onInputRef.current(value);
      }
    });

    window.addEventListener("resize", onWindowResize);
    onWindowResize();
    const resizeObserver = new ResizeObserver(() => {
      onWindowResize();
    });
    resizeObserver.observe(containerRef.current);
    window.requestAnimationFrame(onWindowResize);
    const delayedFits = [80, 240, 700].map((ms) =>
      window.setTimeout(() => {
        onWindowResize();
      }, ms)
    );

    return () => {
      terminal.element?.removeEventListener("contextmenu", onContextMenu);
      terminal.element?.removeEventListener("wheel", onWheelZoom);
      window.removeEventListener("resize", onWindowResize);
      resizeObserver.disconnect();
      delayedFits.forEach((id) => window.clearTimeout(id));
      disposeInput.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      terminal.dispose();
    };
  }, [pasteFromClipboard]);

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

  const runCtxCopy = () => {
    const terminal = terminalRef.current;
    if (!terminal?.hasSelection()) return;
    void navigator.clipboard.writeText(terminal.getSelection()).catch(() => {});
    setCtxMenu(null);
  };

  const runCtxPaste = () => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    pasteFromClipboard(terminal);
    setCtxMenu(null);
  };

  const runCtxSelectAll = () => {
    terminalRef.current?.selectAll();
    setCtxMenu(null);
  };

  const terminal = terminalRef.current;
  const canCtxCopy = Boolean(terminal?.hasSelection());

  return (
    <div className="terminal-pane-shell" title={tr("terminal.zoomKeyboardHint")}>
      <div className="terminal-pane" ref={containerRef} />
      <TerminalPaneContextMenu
        ctxMenu={ctxMenu}
        canCtxCopy={canCtxCopy}
        tr={tr}
        onCopy={runCtxCopy}
        onPaste={runCtxPaste}
        onSelectAll={runCtxSelectAll}
      />
      <TerminalPaneLinkOverlay
        linkState={linkState}
        linkError={linkError}
        tr={tr}
        onRetryConnect={onRetryConnect}
        onCloseFailedTab={onCloseFailedTab}
      />
    </div>
  );
}
