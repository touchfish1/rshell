import type { I18nKey } from "../../i18n";
import type { RedisConnection, RedisDatabaseInfo } from "../../services/types";

interface Props {
  open: boolean;
  conn: RedisConnection | null;
  loading: boolean;
  options: RedisDatabaseInfo[];
  value: string;
  saving: boolean;
  result: string | null;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onClose: () => void;
  onChangeValue: (value: string) => void;
  onSubmit: () => void;
}

export function RedisDbSwitchModal({
  open,
  conn,
  loading,
  options,
  value,
  saving,
  result,
  tr,
  onClose,
  onChangeValue,
  onSubmit,
}: Props) {
  if (!open || !conn) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card redis-resizable-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4>{tr("redis.form.dbSwitchTitle")}</h4>
        </div>
        <div className="session-form">
          <input value={conn.name} disabled />
          {loading ? <div className="modal-inline-notice">{tr("redis.form.dbLoading")}</div> : null}
          {!loading ? (
            <div className="redis-db-options">
              {options.map((row) => (
                <button
                  key={`db-opt-${row.db}`}
                  className={`btn btn-ghost redis-db-option ${value === String(row.db) ? "active" : ""}`}
                  onClick={() => onChangeValue(String(row.db))}
                >
                  DB {row.db} ({row.key_count} keys)
                </button>
              ))}
            </div>
          ) : null}
          <input placeholder={tr("redis.form.dbInputPlaceholder")} type="number" min={0} value={value} onChange={(e) => onChangeValue(e.target.value)} />
          {result ? <div className="modal-inline-notice modal-inline-notice-error">{result}</div> : null}
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" disabled={saving} onClick={onClose}>
            {tr("modal.cancel")}
          </button>
          <button className="btn btn-primary" disabled={saving} onClick={onSubmit}>
            {saving ? tr("modal.saving") : tr("redis.form.dbSwitchAction")}
          </button>
        </div>
      </div>
    </div>
  );
}
