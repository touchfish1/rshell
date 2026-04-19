import type { I18nKey } from "../i18n";

interface Props {
  current: string;
  next: string;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UpgradeConfirmModal({ current, next, tr, onConfirm, onCancel }: Props) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="upgrade-confirm-title" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4 id="upgrade-confirm-title">{tr("updater.modalTitle")}</h4>
          <button type="button" className="modal-close" onClick={onCancel} title={tr("modal.close")}>
            ×
          </button>
        </div>
        <p className="modal-body modal-body--preline">{tr("updater.modalBody", { next, current })}</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {tr("modal.cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            {tr("updater.modalInstall")}
          </button>
        </div>
      </div>
    </div>
  );
}
