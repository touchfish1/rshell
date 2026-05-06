import { useMemo, useState } from "react";
import type { MySqlConnection, MySqlTableInfo } from "../../services/types";
import type { I18nKey } from "../../i18n";

interface Props {
  connections: MySqlConnection[];
  selectedId?: string;
  databases: string[];
  activeSchema: string;
  tables: MySqlTableInfo[];
  tablesLoading: boolean;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onSelect: (id: string) => void;
  onOpenConnection: (id: string) => void;
  onOpenContext: (x: number, y: number, connId: string) => void;
  onSelectSchema: (schema: string) => void;
  onOpenSchemaTab: (schema: string) => void;
  onOpenDbContext: (x: number, y: number, schema: string) => void;
  onSelectTable: (table: string) => void;
  onOpenTableTab: (schema: string, table: string) => void;
  onOpenTableEdit: (schema: string, table: string) => void;
  onOpenQueryTop1000?: (schema: string, table: string) => void;
}

export function MySqlSidebar({
  connections,
  selectedId,
  databases,
  activeSchema,
  tables,
  tablesLoading,
  tr,
  onSelect,
  onOpenConnection,
  onOpenContext,
  onSelectSchema,
  onOpenSchemaTab,
  onOpenDbContext,
  onSelectTable,
  onOpenTableTab,
  onOpenTableEdit,
  onOpenQueryTop1000,
}: Props) {
  const [tableFilter, setTableFilter] = useState("");
  const [tableContextMenu, setTableContextMenu] = useState<{ x: number; y: number; table: string } | null>(null);

  const filteredTables = useMemo(() => {
    if (!tableFilter.trim()) return tables;
    const keyword = tableFilter.trim().toLowerCase();
    return tables.filter((t) => t.name.toLowerCase().includes(keyword));
  }, [tables, tableFilter]);

  return (
    <div className="zk-connections-pane mysql-connections-pane">
      <div className="mysql-connections-header">{tr("mysql.page.connections")}</div>
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
                  <div key={db}>
                    <button
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
                    {activeSchema === db && (
                      <div className="mysql-sidebar-table-section">
                        <div className="mysql-sidebar-search-wrap">
                          <span className="mysql-sidebar-search-icon">⌕</span>
                          <input
                            className="mysql-sidebar-search-input"
                            placeholder={tr("mysql.page.filterTables")}
                            value={tableFilter}
                            onChange={(e) => setTableFilter(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="mysql-sidebar-table-list">
                          {tablesLoading ? (
                            <div className="mysql-sidebar-table-status">{tr("sftp.loading")}</div>
                          ) : null}
                          {!tablesLoading && filteredTables.length === 0 ? (
                            <div className="mysql-sidebar-table-status">{tr("mysql.page.selectDbToViewTables")}</div>
                          ) : null}
                          {filteredTables.map((table) => (
                            <button
                              key={table.name}
                              className="mysql-sidebar-table-row"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectTable(table.name);
                              }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                onOpenTableTab(db, table.name);
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setTableContextMenu({ x: e.clientX, y: e.clientY, table: table.name });
                              }}
                              title={table.name}
                            >
                              <span className="mysql-sidebar-table-name">{table.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {tableContextMenu ? (
        <div className="mysql-context-menu" style={{ left: tableContextMenu.x, top: tableContextMenu.y }}>
          <button
            className="mysql-context-item"
            onClick={() => {
              onOpenTableEdit(activeSchema, tableContextMenu.table);
              setTableContextMenu(null);
            }}
          >
            {tr("mysql.page.editTable")}
          </button>
          <button
            className="mysql-context-item"
            onClick={() => {
              onOpenTableTab(activeSchema, tableContextMenu.table);
              setTableContextMenu(null);
            }}
          >
            {tr("mysql.page.queryTop1000")}
          </button>
          <button
            className="mysql-context-item"
            onClick={() => {
              void navigator.clipboard.writeText(tableContextMenu.table).catch(() => undefined);
              setTableContextMenu(null);
            }}
          >
            {tr("mysql.page.copyName")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
