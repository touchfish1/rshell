import { useEffect, useState } from "react";
import { testMySqlConnection } from "../../services/bridge";
import type { I18nKey } from "../../i18n";
import type { MySqlConnectionInput } from "../../services/types";
import { PasswordVisibilityToggle } from "../../components/session/PasswordVisibilityToggle";

interface Props {
  open: boolean;
  editMode: boolean;
  selectedId?: string;
  form: MySqlConnectionInput;
  secret: string;
  testing: boolean;
  testResult: string | null;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onClose: () => void;
  onChangeForm: (updater: (prev: MySqlConnectionInput) => MySqlConnectionInput) => void;
  onChangeSecret: (value: string) => void;
  setTesting: (value: boolean) => void;
  setTestResult: (value: string | null) => void;
  onSave: () => Promise<void>;
}

export function MySqlConnectionModal({
  open,
  editMode,
  form,
  secret,
  testing,
  testResult,
  tr,
  onClose,
  onChangeForm,
  onChangeSecret,
  setTesting,
  setTestResult,
  onSave,
}: Props) {
  const [secretVisible, setSecretVisible] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h4>{tr("mysql.page.addConnection")}</h4>
        </div>
        <div className="modal-form" onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void onSave();
          }
        }}>
          <input className="mysql-field mysql-modal-input" value={form.name} onChange={(e) => onChangeForm((p) => ({ ...p, name: e.target.value }))} placeholder={tr("form.name")} />
          <input className="mysql-field mysql-modal-input" value={form.host} onChange={(e) => onChangeForm((p) => ({ ...p, host: e.target.value }))} placeholder={tr("form.host")} />
          <input className="mysql-field mysql-modal-input" type="number" value={form.port ?? 3306} onChange={(e) => onChangeForm((p) => ({ ...p, port: Number(e.target.value) }))} placeholder={tr("form.port")} />
          <input className="mysql-field mysql-modal-input" value={form.username} onChange={(e) => onChangeForm((p) => ({ ...p, username: e.target.value }))} placeholder={tr("form.username")} />
          <input className="mysql-field mysql-modal-input" value={form.database ?? ""} onChange={(e) => onChangeForm((p) => ({ ...p, database: e.target.value }))} placeholder={tr("mysql.form.database")} />
          <div className="password-input-wrap">
            <input className="mysql-field mysql-modal-input" type={secretVisible ? "text" : "password"} autoComplete="new-password" value={secret} onChange={(e) => onChangeSecret(e.target.value)} placeholder={tr("form.secretOptional")} />
            <PasswordVisibilityToggle
              visible={secretVisible}
              loading={false}
              showTitle={tr("form.toggleShowPassword")}
              hideTitle={tr("form.toggleHidePassword")}
              onClick={() => setSecretVisible((v) => !v)}
            />
          </div>
          {testResult ? <div className="modal-inline-notice">{testResult}</div> : null}
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>{tr("modal.cancel")}</button>
          <button className="btn btn-ghost" disabled={testing} onClick={() => {
            setTesting(true);
            setTestResult(null);
            void testMySqlConnection(form.host, form.port ?? 3306, form.username, form.database ?? undefined, secret)
              .then(() => setTestResult(tr("modal.testSuccess")))
              .catch((err) => {
                const message = err instanceof Error ? err.message : String(err);
                setTestResult(tr("modal.testFailed", { message }));
              })
              .finally(() => setTesting(false));
          }}>{testing ? tr("modal.testing") : tr("modal.testConnection")}</button>
          <button className="btn" onClick={() => void onSave()}>{editMode ? tr("modal.save") : tr("modal.add")}</button>
        </div>
      </div>
    </div>
  );
}
