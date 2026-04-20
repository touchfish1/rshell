import type { I18nKey } from "../../i18n";
import type { RedisConnectionInput } from "../../services/types";
import { PasswordVisibilityToggle } from "../../components/session/PasswordVisibilityToggle";

interface Props {
  open: boolean;
  title: string;
  host: string;
  port: number | "";
  form: RedisConnectionInput;
  secret: string;
  secretVisible: boolean;
  testing: boolean;
  saving: boolean;
  testResult: string | null;
  saveResult: string | null;
  submitLabel: string;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onClose: () => void;
  onChangeHost: (value: string) => void;
  onChangePort: (value: number | "") => void;
  onChangeForm: (next: RedisConnectionInput) => void;
  onChangeSecret: (value: string) => void;
  onToggleSecretVisible: () => void;
  onTest: () => void;
  onSubmit: () => void;
}

export function RedisConnectionModal({
  open,
  title,
  host,
  port,
  form,
  secret,
  secretVisible,
  testing,
  saving,
  testResult,
  saveResult,
  submitLabel,
  tr,
  onClose,
  onChangeHost,
  onChangePort,
  onChangeForm,
  onChangeSecret,
  onToggleSecretVisible,
  onTest,
  onSubmit,
}: Props) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card redis-resizable-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4>{title}</h4>
        </div>
        <div className="session-form">
          <input placeholder={tr("form.name")} value={form.name} onChange={(e) => onChangeForm({ ...form, name: e.target.value })} />
          <input placeholder={tr("form.host")} value={host} onChange={(e) => onChangeHost(e.target.value)} />
          <input
            placeholder={tr("form.port")}
            type="number"
            value={port}
            onChange={(e) => onChangePort(e.target.value === "" ? "" : Number(e.target.value))}
          />
          <input
            placeholder={tr("redis.form.db")}
            type="number"
            value={form.db ?? 0}
            onChange={(e) => onChangeForm({ ...form, db: Number(e.target.value) })}
          />
          <div className="password-input-wrap">
            <input
              placeholder={tr("form.secretOptional")}
              type={secretVisible ? "text" : "password"}
              value={secret}
              onChange={(e) => onChangeSecret(e.target.value)}
            />
            <PasswordVisibilityToggle
              visible={secretVisible}
              loading={false}
              showTitle={tr("form.toggleShowPassword")}
              hideTitle={tr("form.toggleHidePassword")}
              onClick={onToggleSecretVisible}
            />
          </div>
          {testResult ? <div className="modal-inline-notice">{testResult}</div> : null}
          {saveResult ? <div className="modal-inline-notice modal-inline-notice-error">{saveResult}</div> : null}
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" disabled={saving} onClick={onClose}>
            {tr("modal.cancel")}
          </button>
          <button className="btn btn-ghost" disabled={testing || saving || !host.trim()} onClick={onTest}>
            {testing ? tr("modal.testing") : tr("modal.testConnection")}
          </button>
          <button className="btn btn-primary" disabled={saving || !host.trim()} onClick={onSubmit}>
            {saving ? tr("modal.saving") : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
