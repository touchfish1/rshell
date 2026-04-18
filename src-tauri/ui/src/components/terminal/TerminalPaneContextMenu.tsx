import type { I18nKey } from "../../i18n";

type CtxMenu = { x: number; y: number } | null;

interface Props {
  ctxMenu: CtxMenu;
  canCtxCopy: boolean;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onCopy: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
}

export function TerminalPaneContextMenu({ ctxMenu, canCtxCopy, tr, onCopy, onPaste, onSelectAll }: Props) {
  if (!ctxMenu) return null;
  return (
    <div
      className="terminal-context-menu"
      style={{ left: ctxMenu.x, top: ctxMenu.y }}
      role="menu"
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" role="menuitem" disabled={!canCtxCopy} onClick={onCopy}>
        {tr("terminal.contextCopy")}
      </button>
      <button type="button" role="menuitem" onClick={onPaste}>
        {tr("terminal.contextPaste")}
      </button>
      <button type="button" role="menuitem" onClick={onSelectAll}>
        {tr("terminal.contextSelectAll")}
      </button>
    </div>
  );
}
