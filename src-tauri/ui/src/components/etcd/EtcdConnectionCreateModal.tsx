import type { EtcdConnectionInput } from "../../services/types";
import type { I18nKey } from "../../i18n";

interface Props {
  open: boolean;
  form: EtcdConnectionInput;
  secret: string;
  saving: boolean;
  onClose: () => void;
  onChangeForm: (v: EtcdConnectionInput) => void;
  onChangeSecret: (v: string) => void;
  onSubmit: () => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

export function EtcdConnectionCreateModal({
  open,
  form,
  secret,
  saving,
  onClose,
  onChangeForm,
  onChangeSecret,
  onSubmit,
  tr,
}: Props) {
  if (!open) return null;

  const canSubmit = form.name.trim() && form.endpoints.trim() && !saving;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4>{tr("etcd.modal.newConnection")}</h4>
          <button type="button" className="modal-close" onClick={onClose} title={tr("modal.close")}>
            ×
          </button>
        </div>
        <div className="modal-form">
          <label>
            {tr("etcd.form.name")}
            <input
              type="text"
              className="form-input"
              value={form.name}
              onChange={(e) => onChangeForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            {tr("etcd.form.endpoints")}
            <input
              type="text"
              className="form-input"
              value={form.endpoints}
              onChange={(e) => onChangeForm({ ...form, endpoints: e.target.value })}
              placeholder={tr("etcd.form.endpointsPlaceholder")}
            />
          </label>
          <label>
            {tr("etcd.form.secretOptional")}
            <input
              type="password"
              className="form-input"
              value={secret}
              onChange={(e) => onChangeSecret(e.target.value)}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            {tr("modal.cancel")}
          </button>
          <button className="btn" onClick={onSubmit} disabled={!canSubmit}>
            {saving ? tr("modal.saving") : tr("modal.add")}
          </button>
        </div>
      </div>
    </div>
  );
}
