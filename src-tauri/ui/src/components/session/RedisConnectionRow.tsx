import type { RedisConnection } from "../../services/types";
import type { TrFn } from "../../i18n-context";

interface Props {
  conn: RedisConnection;
  tr: TrFn;
  onConnect?: (id: string) => void;
  onEdit: (conn: RedisConnection) => void | Promise<void>;
  onDelete: (conn: RedisConnection) => void;
}

export function RedisConnectionRow({ conn, tr, onConnect, onEdit, onDelete }: Props) {
  return (
    <li className="session-line">
      <button className="session-main" onClick={() => onConnect?.(conn.id)} title={tr("home.redis")}>
        <span className="session-col name">
          <span className="os-icon">RD</span>
          <span className="session-name-text">{conn.name}</span>
        </span>
        <span className="session-col host">
          <span className="host-text">{conn.address}</span>
        </span>
        <span className="session-col user">-</span>
        <span className="session-col proto">REDIS</span>
        <span className="session-col port">DB {conn.db}</span>
        <span className="session-col status ok">{tr("session.statusOnline")}</span>
      </button>
      <div className="session-actions">
        <button className="connect" onClick={() => onConnect?.(conn.id)}>
          {tr("session.connect")}
        </button>
        <button className="edit" onClick={() => void onEdit(conn)}>
          {tr("session.editHost")}
        </button>
        <button className="danger" onClick={() => onDelete(conn)}>
          {tr("session.delete")}
        </button>
      </div>
    </li>
  );
}
