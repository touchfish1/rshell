import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorBanner } from "../components/ErrorBanner";
import {
  connectMySql,
  disconnectMySql,
  mySqlExecuteQuery,
  mySqlListColumns,
  mySqlListDatabases,
  mySqlListTables,
  testMySqlConnection,
} from "../services/bridge";
import type { I18nKey } from "../i18n";
import type {
  MySqlColumnInfo,
  MySqlConnection,
  MySqlConnectionInput,
  MySqlTableInfo,
} from "../services/types";

interface Props {
  connections: MySqlConnection[];
  selectedId?: string;
  status: string;
  error: string | null;
  onDismissError: () => void;
  onSelect: (id: string) => void;
  onCreate: (input: MySqlConnectionInput, secret?: string) => Promise<MySqlConnection | null>;
  onUpdate: (id: string, input: MySqlConnectionInput, secret?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onGetSecret: (id: string) => Promise<string | null>;
  onBack: () => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

type MySqlBrowseTab = {
  id: string;
  kind: "database" | "table";
  schema: string;
  table?: string;
  title: string;
};

type MySqlTableDataState = {
  loading: boolean;
  filterColumn: string;
  filterText: string;
  columns: string[];
  rows: Array<Array<string | null>>;
  error?: string;
};


export default function MySqlPage({
  connections,
  selectedId,
  status,
  error,
  onDismissError,
  onSelect,
  onCreate,
  onUpdate,
  onGetSecret,
  onDelete,
  onBack,
  tr,
}: Props) {
  const selected = useMemo(() => connections.find((c) => c.id === selectedId), [connections, selectedId]);
  const [databases, setDatabases] = useState<string[]>([]);
  const [tables, setTables] = useState<MySqlTableInfo[]>([]);
  const [, setColumns] = useState<MySqlColumnInfo[]>([]);
  const [activeSchema, setActiveSchema] = useState("");
  const [activeTable, setActiveTable] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [secret, setSecret] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [form, setForm] = useState<MySqlConnectionInput>({
    name: "",
    host: "127.0.0.1",
    port: 3306,
    username: "root",
    database: "",
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; connId: string } | null>(null);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [browseTabs, setBrowseTabs] = useState<MySqlBrowseTab[]>([]);
  const [activeBrowseTabId, setActiveBrowseTabId] = useState<string | null>(null);
  const [tableDataMap, setTableDataMap] = useState<Record<string, MySqlTableDataState>>({});
  const dataScrollRef = useRef<HTMLDivElement | null>(null);
  const activeBrowseTab = useMemo(
    () => browseTabs.find((item) => item.id === activeBrowseTabId) ?? null,
    [browseTabs, activeBrowseTabId]
  );
  const activeTableData = activeBrowseTab ? tableDataMap[activeBrowseTab.id] : undefined;
  const filteredRows = useMemo(() => {
    if (!activeTableData) return [];
    const keyword = activeTableData.filterText.trim().toLowerCase();
    if (!keyword) return activeTableData.rows;
    const filterColumn = activeTableData.filterColumn;
    if (filterColumn && filterColumn !== "__all__") {
      const columnIndex = activeTableData.columns.indexOf(filterColumn);
      if (columnIndex >= 0) {
        return activeTableData.rows.filter((row) =>
          String(row[columnIndex] ?? "").toLowerCase().includes(keyword)
        );
      }
    }
    return activeTableData.rows.filter((row) =>
      row.some((cell) => String(cell ?? "").toLowerCase().includes(keyword))
    );
  }, [activeTableData]);

  const ensureConnected = async () => {
    if (!selected) throw new Error(tr("mysql.error.noConnectionSelected"));
    await connectMySql(selected.id);
  };

  const loadTablesForSchema = async (schema: string) => {
    if (!selected) return;
    setTablesLoading(true);
    try {
      const nextTables = await mySqlListTables(selected.id, schema);
      setTables(nextTables);
      setActiveTable("");
      setColumns([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLocalError(message);
    } finally {
      setTablesLoading(false);
    }
  };

  const addDatabaseTab = (schema: string) => {
    const tab: MySqlBrowseTab = {
      id: `db:${schema}:${Date.now()}`,
      kind: "database",
      schema,
      title: schema,
    };
    setBrowseTabs((prev) => [...prev, tab]);
    setActiveBrowseTabId(tab.id);
  };

  const addTableTab = (schema: string, table: string) => {
    const tab: MySqlBrowseTab = {
      id: `table:${schema}.${table}:${Date.now()}`,
      kind: "table",
      schema,
      table,
      title: `${schema}.${table}`,
    };
    setBrowseTabs((prev) => [...prev, tab]);
    setActiveBrowseTabId(tab.id);
    setTableDataMap((prev) => ({
      ...prev,
      [tab.id]: { loading: true, filterColumn: "__all__", filterText: "", columns: [], rows: [] },
    }));
    void loadTableData(tab.id, schema, table);
  };

  const loadTableData = async (tabId: string, schema: string, table: string) => {
    if (!selected) return;
    try {
      await ensureConnected();
      const query = `SELECT * FROM \`${schema}\`.\`${table}\` LIMIT 100`;
      const data = await mySqlExecuteQuery(selected.id, query, 100, 0);
      setTableDataMap((prev) => ({
        ...prev,
        [tabId]: {
          ...(prev[tabId] ?? { loading: false, filterColumn: "__all__", filterText: "", columns: [], rows: [] }),
          loading: false,
          filterColumn: prev[tabId]?.filterColumn ?? "__all__",
          columns: data.columns,
          rows: data.rows,
          error: undefined,
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTableDataMap((prev) => ({
        ...prev,
        [tabId]: {
          ...(prev[tabId] ?? { loading: false, filterColumn: "__all__", filterText: "", columns: [], rows: [] }),
          loading: false,
          filterColumn: prev[tabId]?.filterColumn ?? "__all__",
          columns: [],
          rows: [],
          error: message,
        },
      }));
    }
  };


  const loadSchema = async () => {
    if (!selected) return;
    setBusy(true);
    setLocalError(null);
    try {
      await ensureConnected();
      const dbs = await mySqlListDatabases(selected.id);
      setDatabases(dbs);
      const schema = activeSchema || dbs[0] || "";
      setActiveSchema(schema);
      if (!schema) return;
      setTablesLoading(true);
      const rows = await mySqlListTables(selected.id, schema);
      setTables(rows);
      if (rows[0]) {
        setActiveTable(rows[0].name);
        setColumns(await mySqlListColumns(selected.id, schema, rows[0].name));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLocalError(message);
    } finally {
      setTablesLoading(false);
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!selected) return;
    void loadSchema();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  useEffect(() => {
    if (!formOpen) {
      setTesting(false);
      setTestResult(null);
    }
  }, [formOpen]);


  return (
    <section className="workspace mysql-page">
      <header className="topbar">
        <div className="topbar-title">
          <div className="topbar-title-text">
            <div className="topbar-title-line">{tr("mysql.page.title")}</div>
            <div className="topbar-subtitle">{selected ? selected.name : tr("mysql.page.noSelection")}</div>
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={onBack}>{tr("terminal.back")}</button>
          <button className="btn btn-ghost" onClick={() => {
            setEditMode(false);
            setForm({
              name: "",
              host: "127.0.0.1",
              port: 3306,
              username: "root",
              database: "",
            });
            setSecret("");
            setFormOpen(true);
          }}>{tr("mysql.page.addConnection")}</button>
          <button className="btn btn-ghost" onClick={() => void loadSchema()} disabled={!selected || busy}>{tr("mysql.page.refreshSchema")}</button>
          <button className="btn btn-ghost" onClick={() => selected && void disconnectMySql(selected.id)} disabled={!selected}>{tr("mysql.page.disconnect")}</button>
          <span className={selected ? "pill pill-ok" : "pill"}>{selected ? tr("top.online") : tr("top.offline")}</span>
          <span className="pill pill-muted">{busy ? tr("home.refreshStatusRunning") : status}</span>
        </div>
      </header>
      {error ? <ErrorBanner message={error} onDismiss={onDismissError} /> : null}
      {localError ? <ErrorBanner message={localError} onDismiss={() => setLocalError(null)} /> : null}
      <div className="terminal-layout" style={{ gridTemplateColumns: "280px 8px minmax(0, 1fr)" }}>
        <div className="zk-connections-pane mysql-connections-pane">
          <div className="mysql-connections-header">MySQL Connections</div>
          <div className="mysql-connections-list">
            {connections.map((conn) => (
              <div key={conn.id} className="mysql-tree-node">
                <div
                  className={`mysql-connection-card ${selectedId === conn.id ? "is-selected" : ""}`}
                  onClick={() => onSelect(conn.id)}
                  onDoubleClick={() => {
                    onSelect(conn.id);
                    void connectMySql(conn.id).then(() => loadSchema()).catch((err) => {
                      const message = err instanceof Error ? err.message : String(err);
                      setLocalError(message);
                    });
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setContextMenu({ x: event.clientX, y: event.clientY, connId: conn.id });
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
                        onClick={() => {
                          setActiveSchema(db);
                          void loadTablesForSchema(db);
                        }}
                        onDoubleClick={() => {
                          setActiveSchema(db);
                          addDatabaseTab(db);
                          void loadTablesForSchema(db);
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
        <div className="terminal-splitter redis-layout-splitter" />
        <div className="redis-browser-pane">
          <div className="redis-browser-toolbar mysql-browse-tabs">
            {browseTabs.length === 0 ? (
              <div className="mysql-toolbar-label">双击库/表后在这里显示 tab 列表</div>
            ) : null}
            {browseTabs.map((tab) => (
              <button
                key={tab.id}
                className={`mysql-data-tab ${activeBrowseTabId === tab.id ? "is-selected" : ""}`}
                onClick={() => {
                  setActiveBrowseTabId(tab.id);
                  setActiveSchema(tab.schema);
                  if (tab.kind === "database") {
                    void loadTablesForSchema(tab.schema);
                    return;
                  }
                  if (tab.table) {
                    setActiveTable(tab.table);
                    if (!tableDataMap[tab.id] || tableDataMap[tab.id].rows.length === 0) {
                      setTableDataMap((prev) => ({
                        ...prev,
                        [tab.id]: {
                          ...(prev[tab.id] ?? { loading: false, filterColumn: "__all__", filterText: "", columns: [], rows: [] }),
                          loading: true,
                          columns: [],
                          rows: [],
                        },
                      }));
                      void loadTableData(tab.id, tab.schema, tab.table);
                    }
                  }
                }}
              >
                {tab.title}
              </button>
            ))}
          </div>
          <div className="redis-browser-body">
            <div>
              {activeBrowseTab?.kind === "table" ? (
                <div className="mysql-data-view">
                  <div className="mysql-data-grid-wrap">
                  <div className="mysql-data-filter-bar">
                    <input
                      className="mysql-field mysql-data-filter-input"
                      value={activeTableData?.filterText ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (!activeBrowseTab) return;
                        setTableDataMap((prev) => ({
                          ...prev,
                          [activeBrowseTab.id]: {
                            ...(prev[activeBrowseTab.id] ?? { loading: false, filterColumn: "__all__", columns: [], rows: [] }),
                            filterText: value,
                          },
                        }));
                      }}
                      placeholder="筛选当前表数据（关键字）"
                    />
                    <select
                      className="mysql-field mysql-select mysql-data-filter-select"
                      value={activeTableData?.filterColumn ?? "__all__"}
                      onChange={(event) => {
                        if (!activeBrowseTab) return;
                        const value = event.target.value;
                        setTableDataMap((prev) => ({
                          ...prev,
                          [activeBrowseTab.id]: {
                            ...(prev[activeBrowseTab.id] ?? { loading: false, filterText: "", columns: [], rows: [] }),
                            filterColumn: value,
                          },
                        }));
                      }}
                    >
                      <option value="__all__">全部列</option>
                      {(activeTableData?.columns ?? []).map((column) => (
                        <option key={column} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
                  </div>
                  {activeTableData?.loading ? <div className="mysql-table-empty">加载数据中...</div> : null}
                  {activeTableData?.error ? <div className="mysql-table-empty">{activeTableData.error}</div> : null}
                  {!activeTableData?.loading && !activeTableData?.error ? (
                    <>
                      <div className="mysql-data-table-scroll" ref={dataScrollRef}>
                        <div className="mysql-data-summary">
                          已加载 {activeTableData?.rows.length ?? 0} 行，筛选后 {filteredRows.length} 行
                        </div>
                        <div className="mysql-data-grid-inner">
                          <table className="mysql-data-grid">
                            <thead>
                              <tr>{(activeTableData?.columns ?? []).map((column) => <th key={column}>{column}</th>)}</tr>
                            </thead>
                            <tbody>
                              {filteredRows.map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                  {row.map((cell, cellIndex) => <td key={cellIndex}>{cell ?? "NULL"}</td>)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  ) : null}
                  </div>
                </div>
              ) : (
                <>
                  <h4>数据表（双击打开数据）</h4>
                  <div className="mysql-table-list">
                    {tablesLoading ? <div className="mysql-table-empty">加载中...</div> : null}
                    {!tablesLoading && tables.length === 0 ? <div className="mysql-table-empty">点击左侧数据库查看表</div> : null}
                    {tables.map((table) => (
                      <button
                        key={table.name}
                        className={`mysql-table-item ${activeTable === table.name ? "is-selected" : ""}`}
                        onClick={async () => {
                          setActiveTable(table.name);
                          if (!selected || !activeSchema) return;
                          try {
                            setColumns(await mySqlListColumns(selected.id, activeSchema, table.name));
                          } catch (err) {
                            const message = err instanceof Error ? err.message : String(err);
                            setLocalError(message);
                          }
                        }}
                        onDoubleClick={() => {
                          if (!activeSchema) return;
                          addTableTab(activeSchema, table.name);
                        }}
                      >
                        {table.name}
                      </button>
                    ))}
                  </div>
                  <div className="mysql-table-empty">双击表后，这里会切换为数据页面。</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {formOpen ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h4>{tr("mysql.page.addConnection")}</h4>
            </div>
            <div className="modal-form">
              <input className="mysql-field mysql-modal-input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder={tr("form.name")} />
              <input className="mysql-field mysql-modal-input" value={form.host} onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))} placeholder={tr("form.host")} />
              <input className="mysql-field mysql-modal-input" type="number" value={form.port ?? 3306} onChange={(e) => setForm((p) => ({ ...p, port: Number(e.target.value) }))} placeholder={tr("form.port")} />
              <input className="mysql-field mysql-modal-input" value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} placeholder={tr("form.username")} />
              <input className="mysql-field mysql-modal-input" value={form.database ?? ""} onChange={(e) => setForm((p) => ({ ...p, database: e.target.value }))} placeholder={tr("mysql.form.database")} />
              <input className="mysql-field mysql-modal-input" type="password" autoComplete="new-password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={tr("form.secretOptional")} />
              {testResult ? <div className="modal-inline-notice">{testResult}</div> : null}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setFormOpen(false)}>{tr("modal.cancel")}</button>
              <button className="btn btn-ghost" disabled={testing} onClick={() => {
                setTesting(true);
                setTestResult(null);
                void testMySqlConnection(form.host, form.port ?? 3306, form.username, form.database ?? undefined, secret)
                  .then(() => setTestResult(tr("modal.testSuccess")))
                  .catch((err) => {
                    const message = err instanceof Error ? err.message : String(err);
                    setTestResult(tr("modal.testFailed", { message }));
                  })
                  .finally(() => setTesting(false));
              }}>{testing ? tr("modal.testing") : tr("modal.testConnection")}</button>
              <button className="btn" onClick={async () => {
                try {
                  if (editMode && selected) {
                    await onUpdate(selected.id, form, secret || undefined);
                    setFormOpen(false);
                    setSecret("");
                    const updatedSecret = await onGetSecret(selected.id);
                    setSecret(updatedSecret ?? "");
                  } else {
                    const created = await onCreate(form, secret || undefined);
                    if (created) {
                      onSelect(created.id);
                      setFormOpen(false);
                      setSecret("");
                    }
                  }
                } catch (err) {
                  const message = err instanceof Error ? err.message : String(err);
                  setLocalError(message);
                }
              }}>{editMode ? tr("modal.save") : tr("modal.add")}</button>
            </div>
          </div>
        </div>
      ) : null}
      {contextMenu ? (
        <div className="mysql-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button
            className="mysql-context-item"
            onClick={() => {
              const target = connections.find((item) => item.id === contextMenu.connId);
              if (!target) return;
              onSelect(target.id);
              setEditMode(true);
              setForm({
                name: target.name,
                host: target.host,
                port: target.port,
                username: target.username,
                database: target.database ?? "",
              });
              setSecret("");
              setFormOpen(true);
              setContextMenu(null);
            }}
          >
            {tr("session.editHost")}
          </button>
          <button
            className="mysql-context-item danger"
            onClick={() => {
              void onDelete(contextMenu.connId);
              setContextMenu(null);
            }}
          >
            {tr("session.delete")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
