import type { I18nKey } from "../../i18n";
import type { RedisConnectionInput } from "../../services/types";
import { useEffect, useMemo, useState } from "react";
import { PasswordVisibilityToggle } from "../../components/session/PasswordVisibilityToggle";

interface Props {
  open: boolean;
  confirmOnClose?: boolean;
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
  confirmOnClose = false,
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
  const [initialSnapshot, setInitialSnapshot] = useState<{ name: string; host: string; port: number | ""; db: number; secret: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setInitialSnapshot({
      name: form.name,
      host,
      port,
      db: Number(form.db ?? 0),
      secret,
    });
  }, [open, form.name, host, port, form.db, secret]);

  const hasDirty = useMemo(() => {
    if (!initialSnapshot) return false;
    return (
      form.name !== initialSnapshot.name ||
      host !== initialSnapshot.host ||
      port !== initialSnapshot.port ||
      Number(form.db ?? 0) !== initialSnapshot.db ||
      secret !== initialSnapshot.secret
    );
  }, [form.name, host, port, form.db, secret, initialSnapshot]);
  if (!open) return null;
  const requestClose = () => {
    if (!confirmOnClose || !hasDirty || saving || testing) {
      onClose();
      return;
    }
    const ok = window.confirm(`${tr("modal.unsavedCloseTitle")}\n${tr("modal.unsavedCloseMessage")}`);
    if (ok) onClose();
  };
  return (
    <div className="modal-backdrop" onClick={requestClose}>
      <div className="modal-card redis-resizable-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
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
          <button className="btn btn-ghost" disabled={saving} onClick={requestClose}>
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
