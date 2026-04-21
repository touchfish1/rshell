import { useEffect, useMemo, useState } from "react";
import { ErrorBanner } from "../components/ErrorBanner";
import { connectMySql, mySqlExecuteQuery } from "../services/bridge";
import type { I18nKey } from "../i18n";
import type { MySqlConnection } from "../services/types";

type DataTab = {
  id: string;
  schema: string;
  table: string;
  columns: string[];
  rows: Array<Array<string | null>>;
  page: number;
  pageSize: number;
  totalRows: number;
  filterText: string;
  loading: boolean;
  error?: string;
};

interface Props {
  connection?: MySqlConnection;
  schema: string;
  table: string;
  error: string | null;
  onDismissError: () => void;
  onBack: () => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

export default function MySqlDataPage({ connection, schema, table, error, onDismissError, onBack }: Props) {
  const PAGE_SIZE = 100;
  const [tabs, setTabs] = useState<DataTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeTabId) ?? null, [tabs, activeTabId]);
  const filteredRows = useMemo(() => {
    if (!activeTab) return [];
    const keyword = activeTab.filterText.trim().toLowerCase();
    if (!keyword) return activeTab.rows;
    return activeTab.rows.filter((row) =>
      row.some((cell) => String(cell ?? "").toLowerCase().includes(keyword))
    );
  }, [activeTab]);

  const quote = (value: string) => `\`${value.replace(/`/g, "``")}\``;

  const loadTabPage = async (id: string, schemaName: string, tableName: string, page: number) => {
    if (!connection) return;
    const offset = page * PAGE_SIZE;
    setTabs((prev) =>
      prev.map((item) => (item.id === id ? { ...item, loading: true, error: undefined } : item))
    );
    try {
      await connectMySql(connection.id);
      const query = `SELECT * FROM ${quote(schemaName)}.${quote(tableName)} LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
      const data = await mySqlExecuteQuery(connection.id, query, PAGE_SIZE, offset);
      setTabs((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, columns: data.columns, rows: data.rows, page, loading: false, error: undefined }
            : item
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTabs((prev) => prev.map((item) => (item.id === id ? { ...item, loading: false, error: message } : item)));
      setLocalError(message);
    }
  };

  const openTab = async (schemaName: string, tableName: string) => {
    if (!connection) return;
    const id = `${schemaName}.${tableName}.${Date.now()}`;
    setActiveTabId(id);
    setTabs((prev) => [
      ...prev,
      {
        id,
        schema: schemaName,
        table: tableName,
        columns: [],
        rows: [],
        page: 0,
        pageSize: PAGE_SIZE,
        totalRows: 0,
        filterText: "",
        loading: true,
      },
    ]);
    try {
      await connectMySql(connection.id);
      const countQuery = `SELECT CAST(COUNT(*) AS CHAR) AS total_count FROM ${quote(schemaName)}.${quote(tableName)}`;
      const countResult = await mySqlExecuteQuery(connection.id, countQuery, 1, 0);
      const totalRows = Number(countResult.rows?.[0]?.[0] ?? 0) || 0;
      setTabs((prev) =>
        prev.map((item) => (item.id === id ? { ...item, totalRows } : item))
      );
      await loadTabPage(id, schemaName, tableName, 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTabs((prev) => prev.map((item) => (item.id === id ? { ...item, loading: false, error: message } : item)));
      setLocalError(message);
    }
  };

  useEffect(() => {
    if (!schema || !table) return;
    void openTab(schema, table);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema, table, connection?.id]);

  return (
    <section className="workspace zk-page redis-page">
      <header className="topbar">
        <div className="topbar-title">
          <div className="topbar-title-text">
            <div className="topbar-title-line">MySQL 数据页</div>
            <div className="topbar-subtitle">{connection ? `${connection.name} / ${schema}` : "未选择连接"}</div>
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={onBack}>返回 MySQL</button>
        </div>
      </header>
      {error ? <ErrorBanner message={error} onDismiss={onDismissError} /> : null}
      {localError ? <ErrorBanner message={localError} onDismiss={() => setLocalError(null)} /> : null}
      <div className="mysql-data-panel" style={{ margin: "10px 12px 12px" }}>
        <div className="mysql-data-tabs">
          {tabs.map((tab) => (
            <button key={tab.id} className={`mysql-data-tab ${tab.id === activeTabId ? "is-selected" : ""}`} onClick={() => setActiveTabId(tab.id)}>
              {tab.table}
              <span
                className="mysql-data-tab-close"
                onClick={(event) => {
                  event.stopPropagation();
                  setTabs((prev) => {
                    const next = prev.filter((item) => item.id !== tab.id);
                    setActiveTabId((prevId) => (prevId === tab.id ? (next[next.length - 1]?.id ?? null) : prevId));
                    return next;
                  });
                }}
              >
                ×
              </span>
            </button>
          ))}
        </div>
        {activeTab ? (
          <div className="mysql-data-grid-wrap">
            <div className="mysql-data-tools">
              <div className="mysql-data-filter-bar">
                <input
                  className="mysql-field mysql-data-filter-input"
                  value={activeTab.filterText}
                  onChange={(event) => {
                    const value = event.target.value;
                    setTabs((prev) => prev.map((item) => (item.id === activeTab.id ? { ...item, filterText: value } : item)));
                  }}
                  placeholder="筛选当前表数据（关键字）"
                />
              </div>
              <div className="mysql-data-summary">
                {activeTab.rows.length > 0
                  ? `第 ${activeTab.page + 1} 页，已加载 ${activeTab.rows.length} 行，筛选后 ${filteredRows.length} 行`
                  : "当前表暂无数据（0 行）"}
              </div>
            </div>
            {activeTab.totalRows > activeTab.pageSize ? (
              <div className="mysql-data-tools" style={{ justifyContent: "flex-end", marginBottom: 8 }}>
                <button
                  className="btn btn-ghost"
                  disabled={activeTab.loading || activeTab.page <= 0}
                  onClick={() => void loadTabPage(activeTab.id, activeTab.schema, activeTab.table, activeTab.page - 1)}
                >
                  上一页
                </button>
                <span className="mysql-data-summary" style={{ minWidth: 140, textAlign: "center" }}>
                  {activeTab.page + 1} / {Math.max(1, Math.ceil(activeTab.totalRows / activeTab.pageSize))} 页
                </span>
                <button
                  className="btn btn-ghost"
                  disabled={
                    activeTab.loading ||
                    (activeTab.page + 1) * activeTab.pageSize >= activeTab.totalRows
                  }
                  onClick={() => void loadTabPage(activeTab.id, activeTab.schema, activeTab.table, activeTab.page + 1)}
                >
                  下一页
                </button>
              </div>
            ) : null}
            {activeTab.loading ? <div className="mysql-table-empty">加载数据中...</div> : null}
            {activeTab.error ? <div className="mysql-table-empty">{activeTab.error}</div> : null}
            {!activeTab.loading && !activeTab.error ? (
              <div className="mysql-data-table-scroll">
                <table className="mysql-data-grid">
                  <thead>
                    <tr>{activeTab.columns.map((column) => <th key={column}>{column}</th>)}</tr>
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
            ) : null}
          </div>
        ) : (
          <div className="mysql-table-empty" style={{ padding: "12px" }}>暂无打开的数据页 tab</div>
        )}
      </div>
    </section>
  );
}
