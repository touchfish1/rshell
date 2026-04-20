import { useEffect, useMemo, useState } from "react";
import type { RedisConnection, RedisConnectionInput } from "../../services/types";
import { useI18n } from "../../i18n-context";

interface Props {
  connection: RedisConnection | null;
  form: RedisConnectionInput;
  secret: string;
  testing: boolean;
  saving: boolean;
  testResult: string | null;
  onClose: () => void;
  onChangeForm: (next: RedisConnectionInput) => void;
  onChangeSecret: (next: string) => void;
  onTest: () => void;
  onSubmit: () => void;
}

export function RedisConnectionEditModal({
  connection,
  form,
  secret,
  testing,
  saving,
  testResult,
  onClose,
  onChangeForm,
  onChangeSecret,
  onTest,
  onSubmit,
}: Props) {
  const { tr } = useI18n();
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    setSubmitAttempted(false);
  }, [connection?.id]);

  const addressError = !form.address.trim()
    ? tr("modal.requiredField", { field: tr("redis.form.address") })
    : "";
  const dbError =
    form.db != null && (!Number.isInteger(form.db) || form.db < 0) ? tr("redis.form.dbInvalid") : "";
  const canTest = !saving && !testing && !addressError && !dbError;
  const canSubmit = !saving && !addressError && !dbError;

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
            <input
              placeholder={tr("form.name")}
              value={form.name}
              disabled={saving}
              onChange={(e) => onChangeForm({ ...form, name: e.target.value })}
            />
            <input
              placeholder={tr("redis.form.address")}
              value={form.address}
              disabled={saving}
              onChange={(e) => onChangeForm({ ...form, address: e.target.value })}
            />
            {submitAttempted && addressError ? (
              <div className="modal-inline-notice modal-inline-notice-error">{addressError}</div>
            ) : null}
            <input
              placeholder={tr("redis.form.db")}
              type="number"
              min={0}
              value={form.db ?? 0}
              disabled={saving}
              onChange={(e) => onChangeForm({ ...form, db: Number(e.target.value) })}
            />
            {dbError ? <div className="modal-inline-notice modal-inline-notice-error">{dbError}</div> : null}
            <input
              placeholder={tr("form.secretOptional")}
              type="password"
              value={secret}
              disabled={saving}
              onChange={(e) => onChangeSecret(e.target.value)}
            />
            {testResult ? (
              <div className={`modal-inline-notice modal-inline-notice-${noticeTone ?? "info"}`}>{testResult}</div>
            ) : null}
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
