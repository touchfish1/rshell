import type { MySqlConnection } from "../../services/types";
import type { TrFn } from "../../i18n-context";

interface Props {
  conn: MySqlConnection;
  tr: TrFn;
  onConnect?: (id: string) => void;
  onEdit: (conn: MySqlConnection) => void | Promise<void>;
  onDelete: (conn: MySqlConnection) => void;
}

export function MySqlConnectionRow({ conn, tr, onConnect, onEdit, onDelete }: Props) {
  return (
    <li className="session-line">
      <button className="session-main" onClick={() => onConnect?.(conn.id)} title={tr("home.mysql")}>
        <span className="session-col name">
          <span className="os-icon">MY</span>
          <span className="session-name-text">{conn.name}</span>
        </span>
        <span className="session-col host">
          <span className="host-text">{conn.host}:{conn.port}</span>
        </span>
        <span className="session-col user">{conn.username}</span>
        <span className="session-col proto">MYSQL</span>
        <span className="session-col port">{conn.database || "-"}</span>
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
