import { useEffect, useMemo, useState } from "react";
import type { ZookeeperConnection, ZookeeperConnectionInput } from "../../services/types";
import { useI18n } from "../../i18n-context";

interface Props {
  connection: ZookeeperConnection | null;
  form: ZookeeperConnectionInput;
  secret: string;
  secretVisible: boolean;
  secretLoading: boolean;
  testing: boolean;
  saving: boolean;
  testResult: string | null;
  onClose: () => void;
  onChangeForm: (next: ZookeeperConnectionInput) => void;
  onChangeSecret: (next: string) => void;
  onToggleSecretVisible: () => void;
  onTest: () => void;
  onSubmit: () => void;
}

export function ZkConnectionEditModal({
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
  const [initialSecret, setInitialSecret] = useState("");

  useEffect(() => {
    setSubmitAttempted(false);
  }, [connection?.id]);
  useEffect(() => {
    if (!connection) return;
    setInitialSecret(secret);
  }, [connection?.id, secret, connection]);

  const connectError = !form.connect_string.trim()
    ? tr("modal.requiredField", { field: tr("zk.form.connectString") })
    : "";
  const timeoutError =
    form.session_timeout_ms != null && (!Number.isFinite(form.session_timeout_ms) || form.session_timeout_ms < 1000)
      ? tr("zk.modal.timeoutInvalid")
      : "";
  const canTest = !saving && !testing && !connectError && !timeoutError;
  const canSubmit = !saving && !connectError && !timeoutError;

  const noticeTone = useMemo(() => {
    if (!testResult) return null;
    const lower = testResult.toLowerCase();
    if (lower.includes("success") || lower.includes("成功")) return "success";
    if (lower.includes("timeout") || lower.includes("超时")) return "warning";
    return "error";
  }, [testResult]);

  if (!connection) return null;
  const hasDirty =
    form.name !== connection.name ||
    form.connect_string !== connection.connect_string ||
    Number(form.session_timeout_ms ?? 10000) !== Number(connection.session_timeout_ms ?? 10000) ||
    secret !== initialSecret;
  const requestClose = () => {
    if (!hasDirty || saving || testing) {
      onClose();
      return;
    }
    const ok = window.confirm(`${tr("modal.unsavedCloseTitle")}\n${tr("modal.unsavedCloseMessage")}`);
    if (ok) onClose();
  };

  return (
    <div className="modal-backdrop" onClick={requestClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={tr("zk.modal.editConnection")}>
        <div className="modal-header">
          <h4>{tr("zk.modal.editConnection")}</h4>
          <button type="button" className="modal-close" onClick={requestClose} title={tr("modal.close")}>
            ×
          </button>
        </div>
        <div className="modal-form">
          <div className="session-form">
            <input
              placeholder={tr("zk.form.name")}
              value={form.name}
              disabled={saving}
              onChange={(e) => onChangeForm({ ...form, name: e.target.value })}
            />
            <input
              placeholder={tr("zk.form.connectStringPlaceholder")}
              value={form.connect_string}
              disabled={saving}
              onChange={(e) => onChangeForm({ ...form, connect_string: e.target.value })}
            />
            {submitAttempted && connectError ? (
              <div className="modal-inline-notice modal-inline-notice-error">{connectError}</div>
            ) : null}
            <input
              placeholder={tr("zk.form.sessionTimeoutMs")}
              type="number"
              value={form.session_timeout_ms ?? 10000}
              disabled={saving}
              onChange={(e) => onChangeForm({ ...form, session_timeout_ms: Number(e.target.value) })}
            />
            {timeoutError ? <div className="modal-inline-notice modal-inline-notice-error">{timeoutError}</div> : null}
            <input
              placeholder={tr("zk.form.digestAuthOptional")}
              type={secretVisible ? "text" : "password"}
              value={secret}
              disabled={saving || secretLoading}
              onChange={(e) => onChangeSecret(e.target.value)}
            />
            <button type="button" className="btn btn-ghost" onClick={onToggleSecretVisible} disabled={secretLoading}>
              {secretVisible ? tr("form.toggleHidePassword") : tr("form.toggleShowPassword")}
            </button>
            {testResult ? (
              <div className={`modal-inline-notice modal-inline-notice-${noticeTone ?? "info"}`}>{testResult}</div>
            ) : null}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={requestClose} disabled={saving}>
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

