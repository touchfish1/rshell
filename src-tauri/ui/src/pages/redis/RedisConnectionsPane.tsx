import type { I18nKey } from "../../i18n";
import type { RedisConnection } from "../../services/types";

interface Props {
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  connections: RedisConnection[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onOpenDbSwitch: (conn: RedisConnection) => void;
  onOpenEdit: (conn: RedisConnection) => void;
  onDelete: (id: string) => void;
}

export function RedisConnectionsPane({
  tr,
  connections,
  selectedId,
  onSelect,
  onOpenDbSwitch,
  onOpenEdit,
  onDelete,
}: Props) {
  return (
    <aside className="session-list">
      <div className="session-list-header">{tr("redis.page.connectionList")}</div>
      <ul className="session-table-body">
        {connections.map((conn) => (
          <li key={conn.id} className={`session-line redis-conn-line ${selectedId === conn.id ? "active" : ""}`}>
            <button className="session-main redis-conn-main" onClick={() => onSelect(conn.id)}>
              <span className="session-col name redis-conn-name">{conn.name}</span>
              <span className="session-col host redis-conn-host">{conn.address}</span>
              <span className="redis-db-badge">DB {conn.db}</span>
            </button>
            <div className="session-actions redis-conn-actions">
              <button
                className="btn btn-ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDbSwitch(conn);
                }}
              >
                切换 DB
              </button>
              <button
                className="btn btn-ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(conn.id);
                  onOpenEdit(conn);
                }}
              >
                {tr("modal.editHost")}
              </button>
              <button
                className="btn btn-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conn.id);
                }}
              >
                {tr("session.delete")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
