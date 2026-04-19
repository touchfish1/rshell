import type { I18nKey } from "../i18n";

interface Props {
  sessionCount: number;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CloseConfirmModal({ sessionCount, tr, onConfirm, onCancel }: Props) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="close-confirm-title" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4 id="close-confirm-title">{tr("app.closeConfirmTitle")}</h4>
          <button type="button" className="modal-close" onClick={onCancel} title={tr("modal.close")}>
            ×
          </button>
        </div>
        <p className="modal-body">{tr("app.closeConfirmBody", { count: sessionCount })}</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {tr("modal.cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            {tr("app.closeConfirmQuit")}
          </button>
        </div>
      </div>
    </div>
  );
}
