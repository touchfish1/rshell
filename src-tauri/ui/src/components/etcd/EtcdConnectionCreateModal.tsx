import { useEffect, useState } from "react";
import type { EtcdConnectionInput } from "../../services/types";
import type { I18nKey } from "../../i18n";
import { PasswordVisibilityToggle } from "../session/PasswordVisibilityToggle";

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
  const [secretVisible, setSecretVisible] = useState(false);

  if (!open) return null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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
        <div className="modal-form" onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !saving) {
            e.preventDefault();
            if (canSubmit) onSubmit();
          }
        }}>
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
            <div className="password-input-wrap">
              <input
                type={secretVisible ? "text" : "password"}
                className="form-input"
                value={secret}
                onChange={(e) => onChangeSecret(e.target.value)}
              />
              <PasswordVisibilityToggle
                visible={secretVisible}
                loading={false}
                showTitle={tr("form.toggleShowPassword")}
                hideTitle={tr("form.toggleHidePassword")}
                onClick={() => setSecretVisible((v) => !v)}
              />
            </div>
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
