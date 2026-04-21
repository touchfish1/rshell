import { useEffect, useMemo, useState } from "react";
import type { MySqlConnection, MySqlConnectionInput } from "../../services/types";
import { useI18n } from "../../i18n-context";
import { PasswordVisibilityToggle } from "../session/PasswordVisibilityToggle";

interface Props {
  connection: MySqlConnection | null;
  form: MySqlConnectionInput;
  secret: string;
  secretVisible: boolean;
  secretLoading: boolean;
  testing: boolean;
  saving: boolean;
  testResult: string | null;
  onClose: () => void;
  onChangeForm: (next: MySqlConnectionInput) => void;
  onChangeSecret: (next: string) => void;
  onToggleSecretVisible: () => void;
  onTest: () => void;
  onSubmit: () => void;
}

export function MySqlConnectionEditModal({
  connection,
  form,
  secret,
  secretVisible,
  secretLoading,
  testing,
  saving,
  testResult,
  onClose,
  onChangeForm,
  onChangeSecret,
  onToggleSecretVisible,
  onTest,
  onSubmit,
}: Props) {
  const { tr } = useI18n();
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    setSubmitAttempted(false);
  }, [connection?.id]);

  const hostError = !form.host.trim() ? tr("modal.requiredField", { field: tr("form.host") }) : "";
  const usernameError = !form.username.trim() ? tr("modal.requiredField", { field: tr("form.username") }) : "";
  const port = form.port ?? 3306;
  const portError = !Number.isInteger(port) || port < 1 || port > 65535 ? tr("modal.portInvalid") : "";
  const canTest = !saving && !testing && !hostError && !usernameError && !portError;
  const canSubmit = !saving && !hostError && !usernameError && !portError;

  const noticeTone = useMemo(() => {
    if (!testResult) return null;
    const lower = testResult.toLowerCase();
    if (lower.includes("success") || lower.includes("成功")) return "success";
    if (lower.includes("timeout") || lower.includes("超时")) return "warning";
    return "error";
  }, [testResult]);

  if (!connection) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4>{tr("modal.editHost")}</h4>
          <button type="button" className="modal-close" onClick={onClose} title={tr("modal.close")}>
            ×
          </button>
        </div>
        <div className="modal-form">
          <div className="session-form">
            <input placeholder={tr("form.name")} value={form.name} disabled={saving} onChange={(e) => onChangeForm({ ...form, name: e.target.value })} />
            <input placeholder={tr("form.host")} value={form.host} disabled={saving} onChange={(e) => onChangeForm({ ...form, host: e.target.value })} />
            {submitAttempted && hostError ? <div className="modal-inline-notice modal-inline-notice-error">{hostError}</div> : null}
            <input placeholder={tr("form.port")} type="number" value={port} disabled={saving} onChange={(e) => onChangeForm({ ...form, port: Number(e.target.value) })} />
            {portError ? <div className="modal-inline-notice modal-inline-notice-error">{portError}</div> : null}
            <input placeholder={tr("form.username")} value={form.username} disabled={saving} onChange={(e) => onChangeForm({ ...form, username: e.target.value })} />
            {submitAttempted && usernameError ? <div className="modal-inline-notice modal-inline-notice-error">{usernameError}</div> : null}
            <input placeholder={tr("mysql.form.database")} value={form.database ?? ""} disabled={saving} onChange={(e) => onChangeForm({ ...form, database: e.target.value })} />
            <div className="password-input-wrap">
              <input
                placeholder={tr("form.secretOptional")}
                type={secretVisible ? "text" : "password"}
                value={secretVisible ? secret : "*********"}
                readOnly={!secretVisible}
                disabled={saving || secretLoading}
                onChange={(e) => onChangeSecret(e.target.value)}
              />
              <PasswordVisibilityToggle
                visible={secretVisible}
                loading={secretLoading}
                showTitle={tr("form.toggleShowPassword")}
                hideTitle={tr("form.toggleHidePassword")}
                onClick={onToggleSecretVisible}
              />
            </div>
            {testResult ? <div className={`modal-inline-notice modal-inline-notice-${noticeTone ?? "info"}`}>{testResult}</div> : null}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            {tr("modal.cancel")}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onTest} disabled={!canTest}>
            {testing ? tr("modal.testing") : tr("modal.testConnection")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setSubmitAttempted(true);
              if (!canSubmit) return;
              onSubmit();
            }}
            disabled={!canSubmit}
          >
            {saving ? tr("modal.saving") : tr("modal.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
