import { useMemo, useState } from "react";
import type { MySqlConnection, MySqlTableInfo } from "../../services/types";
import type { I18nKey } from "../../i18n";

interface Props {
  connections: MySqlConnection[];
  selectedId?: string;
  databases: string[];
  activeSchema: string;
  activeTable?: string;
  tables: MySqlTableInfo[];
  tablesLoading: boolean;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onSelect: (id: string) => void;
  onOpenConnection: (id: string) => void;
  onOpenContext: (x: number, y: number, connId: string) => void;
  onSelectSchema: (schema: string) => void;
  onOpenSchemaTab: (schema: string) => void;
  onSelectTable: (table: string) => void;
  onOpenTableTab: (schema: string, table: string) => void;
  onOpenTableEdit: (schema: string, table: string) => void;
  onImportDdl?: (schema: string, table: string) => Promise<void>;
  onExportInserts?: (schema: string, table: string) => Promise<void>;
  onOpenQueryWithSql?: (schema: string, sql: string) => void;
  onImportDbDdl?: (schema: string) => Promise<void>;
  onImportDbDml?: (schema: string) => void;
}

export function MySqlSidebar({
  connections,
  selectedId,
  databases,
  activeSchema,
  activeTable,
  tables,
  tablesLoading,
  tr,
  onSelect,
  onOpenConnection,
  onOpenContext,
  onSelectSchema,
  onOpenSchemaTab,
  onSelectTable,
  onOpenTableTab,
  onOpenTableEdit,
  onImportDdl,
  onExportInserts,
  onOpenQueryWithSql,
  onImportDbDdl,
  onImportDbDml,
}: Props) {
  const [tableFilter, setTableFilter] = useState("");
  const [tableContextMenu, setTableContextMenu] = useState<{ x: number; y: number; table: string } | null>(null);
  const [dbContextMenu, setDbContextMenu] = useState<{ x: number; y: number; schema: string } | null>(null);

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
                        event.stopPropagation();
                        setDbContextMenu({ x: event.clientX, y: event.clientY, schema: db });
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
                        {tableFilter.trim() ? (
                          <div className="mysql-sidebar-filter-hint">
                            {filteredTables.length}/{tables.length} {tr("mysql.page.selectColumn")}
                          </div>
                        ) : null}
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
                              className={`mysql-sidebar-table-row${activeTable === table.name ? " is-selected" : ""}`}
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
      {/* Table context menu */}
      {tableContextMenu ? (
        <div className="mysql-context-menu" style={{ left: tableContextMenu.x, top: tableContextMenu.y }}>
          <button className="mysql-context-item" onClick={() => { onOpenTableTab(activeSchema, tableContextMenu.table); setTableContextMenu(null); }}>
            {tr("mysql.page.queryTop1000")}
          </button>
          <button className="mysql-context-item" onClick={() => { onOpenTableEdit(activeSchema, tableContextMenu.table); setTableContextMenu(null); }}>
            {tr("mysql.page.editTable")}
          </button>
          <div className="mysql-context-separator" />
          <button className="mysql-context-item" onClick={() => { onImportDdl?.(activeSchema, tableContextMenu.table); setTableContextMenu(null); }}>
            {tr("mysql.page.importDdl")}
          </button>
          <button className="mysql-context-item" onClick={() => {
            const sql = `SELECT * FROM \`${activeSchema}\`.\`${tableContextMenu.table}\` LIMIT 1000;`;
            onOpenQueryWithSql?.(activeSchema, sql);
            setTableContextMenu(null);
          }}>
            {tr("mysql.page.importDml")}
          </button>
          <button className="mysql-context-item" onClick={() => { onExportInserts?.(activeSchema, tableContextMenu.table); setTableContextMenu(null); }}>
            {tr("mysql.page.exportInserts")}
          </button>
          <div className="mysql-context-separator" />
          <button className="mysql-context-item" onClick={() => { void navigator.clipboard.writeText(tableContextMenu.table).catch(() => undefined); setTableContextMenu(null); }}>
            {tr("mysql.page.copyName")}
          </button>
        </div>
      ) : null}
      {/* DB context menu */}
      {dbContextMenu ? (
        <div className="mysql-context-menu" style={{ left: dbContextMenu.x, top: dbContextMenu.y }}>
          <button className="mysql-context-item" onClick={() => {
            const sql = `SELECT * FROM \`${dbContextMenu.schema}\`.\`${tables[0]?.name ?? ""}\` LIMIT 1000;`;
            onOpenQueryWithSql?.(dbContextMenu.schema, sql);
            setDbContextMenu(null);
          }}>
            {tr("mysql.page.newQuery")}
          </button>
          <div className="mysql-context-separator" />
          <button className="mysql-context-item" onClick={() => { onImportDbDdl?.(dbContextMenu.schema); setDbContextMenu(null); }}>
            {tr("mysql.page.importDbDdl")}
          </button>
          <button className="mysql-context-item" onClick={() => { onImportDbDml?.(dbContextMenu.schema); setDbContextMenu(null); }}>
            {tr("mysql.page.importDbDml")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
