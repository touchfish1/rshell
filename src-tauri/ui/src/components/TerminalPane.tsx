import { useCallback } from "react";
import "xterm/css/xterm.css";
import type { TabLinkState } from "../services/types";
import { useI18n } from "../i18n-context";
import { TerminalPaneContextMenu } from "./terminal/TerminalPaneContextMenu";
import { TerminalPaneLinkOverlay } from "./terminal/TerminalPaneLinkOverlay";
import { useAppTheme } from "../theme-context";
import { useTerminalInput } from "./terminal/useTerminalInput";
import { useTerminalOverlays } from "./terminal/useTerminalOverlays";
import { useTerminalLifecycle } from "./terminal/useTerminalLifecycle";

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
  const { resolved: colorTheme } = useAppTheme();
  const { attachCustomKeyHandler, pasteFromClipboard } = useTerminalInput();
  const { containerRef, terminalRef } = useTerminalLifecycle({
    isActive,
    connected,
    colorTheme,
    onInput,
    onResize,
    registerWriter,
    attachCustomKeyHandler,
    onContextMenu: (x, y) => setCtxMenu({ x, y }),
  });
  const { ctxMenu, setCtxMenu, runCtxCopy, runCtxPaste, runCtxSelectAll } = useTerminalOverlays({
    getTerminal: () => terminalRef.current,
    pasteFromClipboard,
  });

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
