import { useMemo, useState } from "react";
import type { Protocol, SessionInput } from "../../services/types";
import { useI18n } from "../../i18n-context";

interface Props {
  open: boolean;
  form: SessionInput;
  secret: string;
  testing: boolean;
  saving: boolean;
  testResult: string | null;
  hostInputRef: React.RefObject<HTMLInputElement>;
  protocolPort: number;
  onClose: () => void;
  onChangeForm: (next: SessionInput) => void;
  onChangeSecret: (next: string) => void;
  onTest: () => void;
  onSubmit: () => void;
  onSubmitAndConnect: () => void;
}

export function HostCreateModal({
  open,
  form,
  secret,
  testing,
  saving,
  testResult,
  hostInputRef,
  protocolPort,
  onClose,
  onChangeForm,
  onChangeSecret,
  onTest,
  onSubmit,
  onSubmitAndConnect,
}: Props) {
  const { tr } = useI18n();
  const [touched, setTouched] = useState({
    host: false,
    port: false,
    username: false,
    secret: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const hostError = !form.host.trim() ? tr("modal.requiredField", { field: tr("form.host") }) : "";
  const portError = !Number.isInteger(form.port) || form.port < 1 || form.port > 65535 ? tr("modal.portInvalid") : "";
  const usernameError =
    form.protocol === "zookeeper" || form.protocol === "redis" || form.username.trim()
      ? ""
      : tr("modal.requiredField", { field: tr("form.username") });
  const secretError = form.protocol === "ssh" && !secret.trim() ? tr("modal.sshPasswordRequired") : "";
  const canTest = !saving && !testing && !hostError && !portError;
  const canSubmit = !saving && !hostError && !portError && !usernameError && !secretError;
  const shouldWarnUntested = submitAttempted && !testing && !testResult;

  const testNoticeTone = useMemo(() => {
    if (!testResult) return null;
    const lower = testResult.toLowerCase();
    if (lower.includes("success") || lower.includes("online") || lower.includes("成功")) return "success";
    if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("超时")) return "warning";
    return "error";
  }, [testResult]);

  const shouldShowError = (fieldTouched: boolean, hasError: string) => (submitAttempted || fieldTouched) && Boolean(hasError);
  const hasDirty =
    Boolean(form.name.trim()) ||
    Boolean(form.host.trim()) ||
    Boolean(form.username.trim()) ||
    Boolean(secret.trim()) ||
    form.protocol !== "ssh" ||
    form.port !== 22;

  const requestClose = () => {
    if (!hasDirty || saving || testing) {
      onClose();
      return;
    }
    const ok = window.confirm(`${tr("modal.unsavedCloseTitle")}\n${tr("modal.unsavedCloseMessage")}`);
    if (ok) onClose();
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={requestClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={tr("modal.newHost")}>
        <div className="modal-header">
          <h4>{tr("modal.newHost")}</h4>
          <button type="button" className="modal-close" onClick={requestClose} title={tr("modal.close")}>
            ×
          </button>
        </div>
        <div className="modal-form">
          <div className="session-form">
            <input
              placeholder={tr("form.name")}
              value={form.name}
              disabled={saving}
              onChange={(e) => onChangeForm({ ...form, name: e.target.value })}
            />
            <select
              value={form.protocol}
              disabled={saving}
              onChange={(e) => {
                const protocol = e.target.value as Protocol;
                const currentDefaultPort =
                  form.protocol === "ssh" ? 22 : form.protocol === "telnet" ? 23 : form.protocol === "redis" ? 6379 : form.protocol === "mysql" ? 3306 : 2181;
                const nextDefaultPort =
                  protocol === "ssh" ? 22 : protocol === "telnet" ? 23 : protocol === "redis" ? 6379 : protocol === "mysql" ? 3306 : 2181;
                const keepCustomPort = Boolean(form.port) && form.port !== currentDefaultPort;
                onChangeForm({
                  ...form,
                  protocol,
                  port: keepCustomPort ? form.port : nextDefaultPort,
                });
              }}
            >
              <option value="ssh">SSH</option>
              <option value="telnet">Telnet</option>
              <option value="zookeeper">Zookeeper</option>
              <option value="redis">Redis</option>
              <option value="mysql">MySQL</option>
            </select>
            <input
              ref={hostInputRef}
              placeholder={tr("form.host")}
              value={form.host}
              disabled={saving}
              onBlur={() => setTouched((prev) => ({ ...prev, host: true }))}
              onChange={(e) => {
                const host = e.target.value;
                onChangeForm({
                  ...form,
                  host,
                  name: form.name || host,
                });
              }}
            />
            {shouldShowError(touched.host, hostError) ? <div className="modal-inline-notice modal-inline-notice-error">{hostError}</div> : null}
            <input
              placeholder={tr("form.port")}
              type="number"
              value={form.port || protocolPort}
              disabled={saving}
              onBlur={() => setTouched((prev) => ({ ...prev, port: true }))}
              onChange={(e) => onChangeForm({ ...form, port: Number(e.target.value) })}
            />
            {shouldShowError(touched.port, portError) ? <div className="modal-inline-notice modal-inline-notice-error">{portError}</div> : null}
            {form.protocol !== "zookeeper" && form.protocol !== "redis" ? (
              <>
                <input
                  placeholder={tr("form.username")}
                  value={form.username}
                  disabled={saving}
                  onBlur={() => setTouched((prev) => ({ ...prev, username: true }))}
                  onChange={(e) => onChangeForm({ ...form, username: e.target.value })}
                />
                {shouldShowError(touched.username, usernameError) ? (
                  <div className="modal-inline-notice modal-inline-notice-error">{usernameError}</div>
                ) : null}
              </>
            ) : null}
            <input
              placeholder={form.protocol === "ssh" ? tr("form.sshPasswordSaved") : tr("form.secretOptional")}
              type="password"
              value={secret}
              disabled={saving}
              onBlur={() => setTouched((prev) => ({ ...prev, secret: true }))}
              onChange={(e) => onChangeSecret(e.target.value)}
            />
            {shouldShowError(touched.secret, secretError) ? <div className="modal-inline-notice modal-inline-notice-error">{secretError}</div> : null}
            {shouldWarnUntested ? (
              <div className="modal-inline-notice modal-inline-notice-warning">{tr("modal.saveWithoutTestHint")}</div>
            ) : null}
            {testResult ? <div className={`modal-inline-notice modal-inline-notice-${testNoticeTone ?? "info"}`}>{testResult}</div> : null}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={requestClose} disabled={saving}>
            {tr("modal.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onTest}
            disabled={!canTest}
          >
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
            {saving ? tr("modal.saving") : tr("modal.add")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setSubmitAttempted(true);
              if (!canSubmit) return;
              onSubmitAndConnect();
            }}
            disabled={!canSubmit}
          >
            {saving ? tr("modal.saving") : tr("modal.addAndConnect")}
          </button>
        </div>
      </div>
    </div>
  );
}
