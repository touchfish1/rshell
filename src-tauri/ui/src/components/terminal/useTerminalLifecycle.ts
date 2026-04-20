import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { getTerminalFontFamily } from "../../lib/terminalFontFamily";
import { getXtermITheme } from "../../lib/xtermThemes";
import {
  adjustTerminalFontSize,
  getTerminalFontSize,
  persistTerminalFontSize,
  TERMINAL_FONT_DEFAULT,
  TERMINAL_FONT_MAX,
  TERMINAL_FONT_MIN,
} from "../../lib/terminalFontSize";

interface UseTerminalLifecycleArgs {
  isActive: boolean;
  connected: boolean;
  colorTheme: "light" | "dark";
  onInput: (text: string) => void;
  onResize: (cols: number, rows: number) => void;
  registerWriter: (writer: (content: string) => void) => void;
  attachCustomKeyHandler: (terminal: Terminal, applyFontSize: (nextSize: number) => void) => void;
  onContextMenu: (x: number, y: number) => void;
}

export function useTerminalLifecycle({
  isActive,
  connected,
  colorTheme,
  onInput,
  onResize,
  registerWriter,
  attachCustomKeyHandler,
  onContextMenu,
}: UseTerminalLifecycleArgs) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const connectedRef = useRef(connected);
  const activeRef = useRef(isActive);
  const onInputRef = useRef(onInput);
  const onResizeRef = useRef(onResize);
  const registerWriterRef = useRef(registerWriter);
  const colorThemeRef = useRef(colorTheme);
  const lastResizeRef = useRef<{ cols: number; rows: number; at: number }>({ cols: 0, rows: 0, at: 0 });

  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);
  useEffect(() => {
    activeRef.current = isActive;
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
    colorThemeRef.current = colorTheme;
  }, [colorTheme]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.theme = getXtermITheme(colorTheme);
    terminal.options.fontFamily = getTerminalFontFamily();
    if (terminal.rows > 0) terminal.refresh(0, terminal.rows - 1);
  }, [colorTheme]);

  useEffect(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!isActive || !terminal || !fitAddon) return;
    const resync = () => {
      fitAddon.fit();
      if (terminal.rows > 0) terminal.refresh(0, terminal.rows - 1);
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
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: getTerminalFontSize(),
      fontFamily: getTerminalFontFamily(),
      theme: getXtermITheme(colorThemeRef.current),
    });
    const fitAddon = new FitAddon();
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    terminal.loadAddon(fitAddon);
    terminal.open(container);

    const syncPaneHeight = () => {
      const pane = containerRef.current;
      const parent = pane?.parentElement;
      if (!pane || !parent) return;
      const height = parent.clientHeight;
      if (height > 0) pane.style.height = `${height}px`;
    };
    const onWindowResize = () => {
      syncPaneHeight();
      fitAddon.fit();
      if (!activeRef.current) return;
      const now = Date.now();
      const last = lastResizeRef.current;
      if (terminal.cols === last.cols && terminal.rows === last.rows && now - last.at < 400) return;
      lastResizeRef.current = { cols: terminal.cols, rows: terminal.rows, at: now };
      onResizeRef.current(terminal.cols, terminal.rows);
    };
    const applyFontSize = (raw: number) => {
      const next = Math.max(TERMINAL_FONT_MIN, Math.min(TERMINAL_FONT_MAX, Math.round(raw)));
      persistTerminalFontSize(next);
      terminal.options.fontSize = next;
      onWindowResize();
    };

    attachCustomKeyHandler(terminal, applyFontSize);
    terminal.focus();
    fitAddon.fit();

    const onContext = (event: MouseEvent) => {
      event.preventDefault();
      onContextMenu(event.clientX, event.clientY);
    };
    terminal.element?.addEventListener("contextmenu", onContext);

    const onWheelZoom = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1;
      applyFontSize(adjustTerminalFontSize(terminal.options.fontSize ?? TERMINAL_FONT_DEFAULT, delta));
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
      if (connectedRef.current) scheduleFit();
    });

    const disposeInput = terminal.onData((value) => {
      if (!connectedRef.current) {
        terminal.write(value);
      } else {
        onInputRef.current(value);
      }
    });

    const applyAppearance = () => {
      terminal.options.theme = getXtermITheme(colorThemeRef.current);
      terminal.options.fontFamily = getTerminalFontFamily();
      if (terminal.rows > 0) terminal.refresh(0, terminal.rows - 1);
    };

    window.addEventListener("rshell-terminal-font-changed", applyAppearance);
    window.addEventListener("resize", onWindowResize);
    onWindowResize();
    const resizeObserver = new ResizeObserver(() => onWindowResize());
    resizeObserver.observe(container);
    window.requestAnimationFrame(onWindowResize);
    const delayedFits = [80, 240, 700].map((ms) => window.setTimeout(onWindowResize, ms));

    return () => {
      window.removeEventListener("rshell-terminal-font-changed", applyAppearance);
      window.removeEventListener("resize", onWindowResize);
      terminal.element?.removeEventListener("contextmenu", onContext);
      terminal.element?.removeEventListener("wheel", onWheelZoom);
      resizeObserver.disconnect();
      delayedFits.forEach((id) => window.clearTimeout(id));
      disposeInput.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      terminal.dispose();
    };
  }, [attachCustomKeyHandler, onContextMenu]);

  return { containerRef, terminalRef };
}

