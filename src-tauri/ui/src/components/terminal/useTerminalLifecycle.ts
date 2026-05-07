import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { getTerminalFontFamily } from "../../lib/terminalFontFamily";
import { getAllSettings, getTerminalCustomColors, getAnsiColors } from "../../lib/appSettings";
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
  const onContextMenuRef = useRef(onContextMenu);
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
    onContextMenuRef.current = onContextMenu;
  }, [onContextMenu]);

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
      fitAndReserveBottom();
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

    const baseTheme = getXtermITheme(colorThemeRef.current);
    const customColors = getTerminalCustomColors();
    const settings = getAllSettings();
    const ansiColors = getAnsiColors();
    const terminal = new Terminal({
      cursorBlink: settings.terminalCursorBlink,
      cursorStyle: settings.terminalCursorStyle,
      cursorWidth: settings.terminalCursorWidth,
      scrollback: settings.terminalScrollback,
      lineHeight: settings.terminalLineHeight,
      letterSpacing: settings.terminalLetterSpacing,
      bellStyle: settings.terminalBellStyle,
      fontSize: getTerminalFontSize(),
      fontFamily: getTerminalFontFamily(),
      theme: { ...baseTheme, ...(ansiColors ?? {}), foreground: customColors.foreground, background: customColors.background, cursor: customColors.cursor, cursorAccent: customColors.background },
    });
    const fitAddon = new FitAddon();
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    if (container) container.style.opacity = String(settings.terminalOpacity / 100);

    const syncPaneHeight = () => {
      const pane = containerRef.current;
      const parent = pane?.parentElement;
      if (!pane || !parent) return;
      const height = parent.clientHeight;
      if (height > 0) pane.style.height = `${height}px`;
    };
    const fitAndReserveBottom = () => {
      fitAddon.fit();
      if (terminal.rows > 3) {
        terminal.resize(terminal.cols, terminal.rows - 1);
      }
    };
    const onWindowResize = () => {
      syncPaneHeight();
      fitAndReserveBottom();
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
    fitAndReserveBottom();

    const onContext = (event: MouseEvent) => {
      event.preventDefault();
      onContextMenuRef.current(event.clientX, event.clientY);
    };
    terminal.element?.addEventListener("contextmenu", onContext);

    const onAutoCopy = () => {
      const s = getAllSettings();
      if (!s.autoCopySelection) return;
      const sel = terminal.getSelection();
      if (sel && navigator.clipboard) {
        navigator.clipboard.writeText(sel).catch(() => {});
      }
    };
    terminal.element?.addEventListener("mouseup", onAutoCopy);

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
      const base = getXtermITheme(colorThemeRef.current);
      const custom = getTerminalCustomColors();
      const s = getAllSettings();
      const ansi = getAnsiColors();
      terminal.options.theme = {
        ...base,
        ...(ansi ?? {}),
        foreground: custom.foreground,
        background: custom.background,
        cursor: custom.cursor,
        cursorAccent: custom.background,
      };
      terminal.options.fontFamily = getTerminalFontFamily();
      terminal.options.cursorStyle = s.terminalCursorStyle;
      terminal.options.cursorBlink = s.terminalCursorBlink;
      terminal.options.cursorWidth = s.terminalCursorWidth;
      terminal.options.lineHeight = s.terminalLineHeight;
      terminal.options.letterSpacing = s.terminalLetterSpacing;
      terminal.options.bellStyle = s.terminalBellStyle;
      if (container) container.style.opacity = String(s.terminalOpacity / 100);
      if (terminal.rows > 0) terminal.refresh(0, terminal.rows - 1);
    };

    window.addEventListener("rshell-terminal-font-changed", applyAppearance);
    window.addEventListener("rshell-settings-changed", applyAppearance);
    window.addEventListener("resize", onWindowResize);
    onWindowResize();
    const resizeObserver = new ResizeObserver(() => onWindowResize());
    resizeObserver.observe(container);
    window.requestAnimationFrame(onWindowResize);
    const delayedFits = [80, 240, 700].map((ms) => window.setTimeout(onWindowResize, ms));

    return () => {
      window.removeEventListener("rshell-terminal-font-changed", applyAppearance);
      window.removeEventListener("rshell-settings-changed", applyAppearance);
      window.removeEventListener("resize", onWindowResize);
      terminal.element?.removeEventListener("contextmenu", onContext);
      terminal.element?.removeEventListener("mouseup", onAutoCopy);
      terminal.element?.removeEventListener("wheel", onWheelZoom);
      resizeObserver.disconnect();
      delayedFits.forEach((id) => window.clearTimeout(id));
      disposeInput.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      terminal.dispose();
    };
  }, [attachCustomKeyHandler]);

  return { containerRef, terminalRef };
}

