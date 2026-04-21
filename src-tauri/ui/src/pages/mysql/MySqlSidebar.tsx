import type { MySqlConnection } from "../../services/types";

interface Props {
  connections: MySqlConnection[];
  selectedId?: string;
  databases: string[];
  activeSchema: string;
  onSelect: (id: string) => void;
  onOpenConnection: (id: string) => void;
  onOpenContext: (x: number, y: number, connId: string) => void;
  onSelectSchema: (schema: string) => void;
  onOpenSchemaTab: (schema: string) => void;
  onOpenDbContext: (x: number, y: number, schema: string) => void;
}

export function MySqlSidebar({
  connections,
  selectedId,
  databases,
  activeSchema,
  onSelect,
  onOpenConnection,
  onOpenContext,
  onSelectSchema,
  onOpenSchemaTab,
  onOpenDbContext,
}: Props) {
  return (
    <div className="zk-connections-pane mysql-connections-pane">
      <div className="mysql-connections-header">MySQL Connections</div>
      <div className="mysql-connections-list">
        {connections.map((conn) => (
          <div key={conn.id} className="mysql-tree-node">
            <div
              className={`mysql-connection-card ${selectedId === conn.id ? "is-selected" : ""}`}
              onClick={() => onSelect(conn.id)}
              onDoubleClick={() => onOpenConnection(conn.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                onOpenContext(event.clientX, event.clientY, conn.id);
              }}
              role="button"
              tabIndex={0}
            >
              <div className="mysql-connection-main">
                <div className="mysql-connection-name">{conn.name || `${conn.host}:${conn.port}`}</div>
                <div className="mysql-connection-meta">{conn.host}:{conn.port}</div>
                <div className="mysql-connection-meta">{conn.username}@{conn.host}</div>
              </div>
            </div>
            {selectedId === conn.id && databases.length > 0 ? (
              <div className="mysql-db-tree">
                {databases.map((db) => (
                  <button
                    key={db}
                    className={`mysql-db-node ${activeSchema === db ? "is-selected" : ""}`}
                    onClick={() => onSelectSchema(db)}
                    onDoubleClick={() => onOpenSchemaTab(db)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      onOpenDbContext(event.clientX, event.clientY, db);
                    }}
                  >
                    {db}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
