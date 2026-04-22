import type { I18nKey } from "../../i18n";
import type { MySqlConnection, MySqlConnectionInput } from "../../services/types";
import type { MySqlDbContextMenuState } from "./types";

interface Props {
  contextMenu: { x: number; y: number; connId: string } | null;
  dbContextMenu: MySqlDbContextMenuState | null;
  connections: MySqlConnection[];
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onCloseContext: () => void;
  onCloseDbContext: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (form: MySqlConnectionInput) => void;
  onCreateQuery: (schema: string) => void;
}

export function MySqlContextMenus({
  contextMenu,
  dbContextMenu,
  connections,
  tr,
  onCloseContext,
  onCloseDbContext,
  onSelect,
  onDelete,
  onEdit,
  onCreateQuery,
}: Props) {
  return (
    <>
      {contextMenu ? (
        <div className="mysql-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button
            className="mysql-context-item"
            onClick={() => {
              const target = connections.find((item) => item.id === contextMenu.connId);
              if (!target) return;
              onSelect(target.id);
              onEdit({
                name: target.name,
                host: target.host,
                port: target.port,
                username: target.username,
                database: target.database ?? "",
              });
              onCloseContext();
            }}
          >
            {tr("session.editHost")}
          </button>
          <button
            className="mysql-context-item danger"
            onClick={() => {
              onDelete(contextMenu.connId);
              onCloseContext();
            }}
          >
            {tr("session.delete")}
          </button>
        </div>
      ) : null}

      {dbContextMenu ? (
        <div className="mysql-context-menu" style={{ left: dbContextMenu.x, top: dbContextMenu.y }}>
          <button
            className="mysql-context-item"
            onClick={() => {
              onCreateQuery(dbContextMenu.schema);
              onCloseDbContext();
            }}
          >
            {tr("mysql.page.newQuery")}
          </button>
        </div>
      ) : null}
    </>
  );
}
