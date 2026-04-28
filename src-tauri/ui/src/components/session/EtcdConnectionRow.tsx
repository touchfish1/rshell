import type { EtcdConnection } from "../../services/types";
import type { TrFn } from "../../i18n-context";

interface Props {
  conn: EtcdConnection;
  tr: TrFn;
  onConnect?: (id: string) => void;
  onEdit: (conn: EtcdConnection) => void | Promise<void>;
  onDelete: (conn: EtcdConnection) => void;
}

export function EtcdConnectionRow({ conn, tr, onConnect, onEdit, onDelete }: Props) {
  return (
    <li className="session-line">
      <button className="session-main" onClick={() => onConnect?.(conn.id)} title="Etcd">
        <span className="session-col name">
          <span className="os-icon">ET</span>
          <span className="session-name-text">{conn.name}</span>
        </span>
        <span className="session-col host">
          <span className="host-text">{conn.endpoints}</span>
        </span>
        <span className="session-col user">-</span>
        <span className="session-col proto">ETCD</span>
        <span className="session-col port">-</span>
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
