import type { EtcdConnection, EtcdConnectionInput } from "../../services/types";
import type { I18nKey } from "../../i18n";

interface Props {
  connection: EtcdConnection | null;
  form: EtcdConnectionInput;
  secret: string;
  secretVisible: boolean;
  secretLoading: boolean;
  saving: boolean;
  onClose: () => void;
  onChangeForm: (v: EtcdConnectionInput) => void;
  onChangeSecret: (v: string) => void;
  onToggleSecretVisible: () => void;
  onSubmit: () => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

export function EtcdConnectionEditModal({
  connection,
  form,
  secret,
  secretVisible,
  secretLoading,
  saving,
  onClose,
  onChangeForm,
  onChangeSecret,
  onToggleSecretVisible,
  onSubmit,
  tr,
}: Props) {
  if (!connection) return null;

  const canSubmit = form.name.trim() && form.endpoints.trim() && !saving;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4>{tr("etcd.modal.editConnection")}</h4>
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
            <div className="secret-input-row">
              <input
                type={secretVisible ? "text" : "password"}
                className="form-input"
                value={secret}
                onChange={(e) => onChangeSecret(e.target.value)}
                disabled={secretLoading}
              />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onToggleSecretVisible}
                disabled={secretLoading}
                title={secretVisible ? tr("form.toggleHidePassword") : tr("form.toggleShowPassword")}
              >
                {secretVisible ? "Hide" : "Show"}
              </button>
            </div>
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            {tr("modal.cancel")}
          </button>
          <button className="btn" onClick={onSubmit} disabled={!canSubmit}>
            {saving ? tr("modal.saving") : tr("modal.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
