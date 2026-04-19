import { useEffect } from "react";
import type { I18nKey } from "../../i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

export function ShortcutHelpModal({ open, onClose, tr }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-help-title"
    >
      <div className="modal-card shortcut-help-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4 id="shortcut-help-title">{tr("shortcutHelp.title")}</h4>
          <button type="button" className="modal-close" onClick={onClose} title={tr("modal.close")}>
            ×
          </button>
        </div>
        <div className="shortcut-help-body">
          <section className="shortcut-help-section">
            <h5>{tr("shortcutHelp.section.workspace")}</h5>
            <ul>
              <li>{tr("shortcutHelp.workspace.switchTabs")}</li>
              <li>{tr("shortcutHelp.workspace.closeTab")}</li>
            </ul>
          </section>
          <section className="shortcut-help-section">
            <h5>{tr("shortcutHelp.section.terminal")}</h5>
            <ul>
              <li>{tr("shortcutHelp.terminal.paste")}</li>
              <li>{tr("shortcutHelp.terminal.copy")}</li>
              <li>{tr("shortcutHelp.terminal.zoom")}</li>
              <li>{tr("shortcutHelp.terminal.contextMenu")}</li>
            </ul>
          </section>
          <section className="shortcut-help-section">
            <h5>{tr("shortcutHelp.section.tabsBar")}</h5>
            <ul>
              <li>{tr("shortcutHelp.tabsBar.middleClick")}</li>
            </ul>
          </section>
          <section className="shortcut-help-section">
            <h5>{tr("shortcutHelp.section.sftp")}</h5>
            <ul>
              <li>{tr("shortcutHelp.sftp.editorEsc")}</li>
              <li>{tr("shortcutHelp.sftp.breadcrumbs")}</li>
            </ul>
          </section>
          <section className="shortcut-help-section">
            <h5>{tr("shortcutHelp.section.hostList")}</h5>
            <ul>
              <li>{tr("shortcutHelp.hostList.keys")}</li>
            </ul>
          </section>
          <section className="shortcut-help-section">
            <h5>{tr("shortcutHelp.section.appearance")}</h5>
            <ul>
              <li>{tr("shortcutHelp.appearance.keys")}</li>
            </ul>
          </section>
          <section className="shortcut-help-section">
            <h5>{tr("shortcutHelp.section.quit")}</h5>
            <ul>
              <li>{tr("shortcutHelp.quit.suspendSessions")}</li>
            </ul>
          </section>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {tr("modal.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
