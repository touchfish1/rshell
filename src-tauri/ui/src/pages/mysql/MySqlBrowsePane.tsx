import { useEffect, useMemo, useState, type RefObject } from "react";
import type { I18nKey } from "../../i18n";
import type { MySqlTableInfo } from "../../services/types";
import { MySqlDataGrid } from "./MySqlDataGrid";
import { MySqlTableDesignEditor } from "./MySqlTableDesignEditor";
import type {
  MySqlBrowseTab,
  MySqlFilterCondition,
  MySqlFilterOperator,
  MySqlQueryEditorState,
  MySqlTableDataState,
  SqlSuggestionState,
} from "./types";

interface Props {
  browseTabs: MySqlBrowseTab[];
  activeBrowseTabId: string | null;
  activeBrowseTab: MySqlBrowseTab | null;
  activeSchema: string;
  activeTable: string;
  selectedConnectionId?: string;
  tables: MySqlTableInfo[];
  tablesLoading: boolean;
  tableDataMap: Record<string, MySqlTableDataState>;
  queryEditorMap: Record<string, MySqlQueryEditorState>;
  activeTableData?: MySqlTableDataState;
  activeQueryEditor?: MySqlQueryEditorState;
  querySuggestions: SqlSuggestionState | null;
  activeSuggestionItems: string[];
  suggestionActiveIndex: number;
  queryEditorRef: RefObject<HTMLTextAreaElement>;
  dataScrollRef: RefObject<HTMLDivElement>;
  filterOperators: Array<{ value: MySqlFilterOperator; label: string }>;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onSelectTab: (tab: MySqlBrowseTab) => void;
  onSelectTable: (table: string) => void;
  onOpenTableTab: (schema: string, table: string) => void;
  onOpenTableEdit: (schema: string, table: string) => void;
  onChangeCondition: (conditionId: string, patch: Partial<MySqlFilterCondition>) => void;
  onDeleteCondition: (conditionId: string) => void;
  onAddCondition: () => void;
  onQueryTable: () => void;
  onChangeTablePage: (page: number) => void;
  onChangePageSize: (pageSize: number) => void;
  onFormatSql: () => void;
  onExplainSql: () => void;
  onRunSql: () => void;
  onSqlEditorChange: (value: string, cursor: number, textarea: HTMLTextAreaElement) => void;
  onSqlEditorClick: (value: string, cursor: number) => void;
  onSqlEditorKeyUp: (key: string, value: string, cursor: number, textarea: HTMLTextAreaElement) => void;
  onSqlEditorKeyDown: (key: string) => void;
  onSqlEditorBlur: () => void;
  onApplySuggestion: (item: string) => void;
}

export function MySqlBrowsePane(props: Props) {
  const {
    browseTabs,
    activeBrowseTabId,
    activeBrowseTab,
    activeSchema,
    activeTable,
    tables,
    tablesLoading,
    activeTableData,
    activeQueryEditor,
    querySuggestions,
    activeSuggestionItems,
    suggestionActiveIndex,
    queryEditorRef,
    dataScrollRef,
    filterOperators,
    tr,
  } = props;
  const [queryResultPage, setQueryResultPage] = useState(0);
  const [queryResultPageSize, setQueryResultPageSize] = useState(100);
  const [queryResultJumpPage, setQueryResultJumpPage] = useState("");
  const [tableJumpPage, setTableJumpPage] = useState("");
  const [tableSqlCopied, setTableSqlCopied] = useState(false);
  const [tableContextMenu, setTableContextMenu] = useState<{ x: number; y: number; table: string } | null>(null);
  const queryResultRows = activeQueryEditor?.result?.rows ?? [];
  const queryResultTotal = queryResultRows.length;
  const queryResultPagedRows = useMemo(() => {
    const offset = queryResultPage * queryResultPageSize;
    return queryResultRows.slice(offset, offset + queryResultPageSize);
  }, [queryResultPage, queryResultPageSize, queryResultRows]);

  useEffect(() => {
    setQueryResultPage(0);
    setQueryResultJumpPage("");
  }, [activeBrowseTab?.id, activeQueryEditor?.result]);

  useEffect(() => {
    if (!tableSqlCopied) return;
    const timer = window.setTimeout(() => setTableSqlCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [tableSqlCopied]);

  useEffect(() => {
    if (!tableContextMenu) return;
    const close = () => setTableContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [tableContextMenu]);

  return (
    <div className="redis-browser-pane">
      <div className="redis-browser-toolbar mysql-browse-tabs">
        {browseTabs.length === 0 ? <div className="mysql-toolbar-label">{tr("mysql.page.tabHint")}</div> : null}
        {browseTabs.map((tab) => (
          <button key={tab.id} className={`mysql-data-tab ${activeBrowseTabId === tab.id ? "is-selected" : ""}`} onClick={() => props.onSelectTab(tab)}>
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
                  <div className="mysql-data-filter-list">
                    {(activeTableData?.conditions ?? []).map((condition) => (
                      <div key={condition.id} className="mysql-data-filter-row">
                        <select className="mysql-field mysql-select mysql-data-filter-select" value={condition.column} onChange={(event) => props.onChangeCondition(condition.id, { column: event.target.value })}>
                          <option value="">{tr("mysql.page.selectColumn")}</option>
                          {(activeTableData?.columns ?? []).map((column) => (
                            <option key={column} value={column}>{column}</option>
                          ))}
                        </select>
                        <select className="mysql-field mysql-select mysql-data-filter-op" value={condition.operator} onChange={(event) => props.onChangeCondition(condition.id, { operator: event.target.value as MySqlFilterOperator })}>
                          {filterOperators.map((operator) => (
                            <option key={operator.value} value={operator.value}>{operator.label}</option>
                          ))}
                        </select>
                        <input
                          className="mysql-field mysql-data-filter-input"
                          value={condition.value}
                          onChange={(event) => props.onChangeCondition(condition.id, { value: event.target.value })}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") props.onQueryTable();
                          }}
                          placeholder={tr("mysql.page.filterValuePlaceholder")}
                        />
                        <button className="btn btn-ghost" onClick={() => props.onDeleteCondition(condition.id)}>{tr("session.delete")}</button>
                      </div>
                    ))}
                  </div>
                  <div className="mysql-data-filter-actions">
                    <button className="btn btn-ghost" onClick={props.onAddCondition}>{tr("mysql.page.addCondition")}</button>
                    <button className="btn" onClick={props.onQueryTable}>{tr("mysql.page.queryDatabase")}</button>
                  </div>
                </div>
                {activeTableData?.loading ? <div className="mysql-table-empty">{tr("sftp.loading")}</div> : null}
                {activeTableData?.error ? <div className="mysql-table-empty">{activeTableData.error}</div> : null}
                {!activeTableData?.loading && !activeTableData?.error ? (
                  <>
                    <div className="mysql-data-table-scroll" ref={dataScrollRef}>
                      <MySqlDataGrid columns={activeTableData?.columns ?? []} rows={activeTableData?.rows ?? []} />
                    </div>
                    {(activeTableData?.totalRows ?? 0) > (activeTableData?.pageSize ?? 100) ? (
                      <div className="mysql-table-pagination">
                        <span className="mysql-data-summary mysql-table-pagination-summary">
                          {tr("mysql.page.tablePageSummary", {
                            page: (activeTableData?.page ?? 0) + 1,
                            rows: activeTableData?.rows.length ?? 0,
                            pageSize: activeTableData?.pageSize ?? 100,
                          })}
                        </span>
                        <select
                          className="mysql-field mysql-select mysql-table-page-size"
                          value={activeTableData?.pageSize ?? 100}
                          onChange={(event) => props.onChangePageSize(Number(event.target.value))}
                        >
                          {[50, 100, 200, 500, 1000].map((size) => (
                            <option key={size} value={size}>
                              {tr("mysql.page.perPage", { size })}
                            </option>
                          ))}
                        </select>
                        <button
                          className="btn btn-ghost mysql-table-page-btn"
                          disabled={(activeTableData?.page ?? 0) <= 0 || Boolean(activeTableData?.loading)}
                          onClick={() => props.onChangeTablePage(Math.max(0, (activeTableData?.page ?? 0) - 1))}
                        >
                          {tr("mysql.page.prevPage")}
                        </button>
                        <span className="mysql-table-empty mysql-table-pagination-text">
                          {((activeTableData?.page ?? 0) + 1)} / {Math.max(1, Math.ceil((activeTableData?.totalRows ?? 0) / (activeTableData?.pageSize ?? 100)))}
                        </span>
                        <input
                          className="mysql-field mysql-table-page-jump"
                          type="number"
                          min={1}
                          max={Math.max(1, Math.ceil((activeTableData?.totalRows ?? 0) / (activeTableData?.pageSize ?? 100)))}
                          value={tableJumpPage}
                          onChange={(event) => setTableJumpPage(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            const totalPages = Math.max(1, Math.ceil((activeTableData?.totalRows ?? 0) / (activeTableData?.pageSize ?? 100)));
                            const raw = Number.parseInt(tableJumpPage, 10);
                            if (!Number.isFinite(raw)) return;
                            const target = Math.min(totalPages, Math.max(1, raw));
                            props.onChangeTablePage(target - 1);
                            setTableJumpPage(String(target));
                          }}
                          placeholder={tr("mysql.page.pagePlaceholder")}
                        />
                        <button
                          className="btn btn-ghost mysql-table-page-btn"
                          onClick={() => {
                            const totalPages = Math.max(1, Math.ceil((activeTableData?.totalRows ?? 0) / (activeTableData?.pageSize ?? 100)));
                            const raw = Number.parseInt(tableJumpPage, 10);
                            if (!Number.isFinite(raw)) return;
                            const target = Math.min(totalPages, Math.max(1, raw));
                            props.onChangeTablePage(target - 1);
                            setTableJumpPage(String(target));
                          }}
                        >
                          {tr("mysql.page.jump")}
                        </button>
                        <button
                          className="btn btn-ghost mysql-table-page-btn"
                          disabled={
                            Boolean(activeTableData?.loading) ||
                            (((activeTableData?.page ?? 0) + 1) * (activeTableData?.pageSize ?? 100) >= (activeTableData?.totalRows ?? 0))
                          }
                          onClick={() => props.onChangeTablePage((activeTableData?.page ?? 0) + 1)}
                        >
                          {tr("mysql.page.nextPage")}
                        </button>
                      </div>
                    ) : null}
                    {activeTableData?.lastSql ? (
                      <button
                        type="button"
                        className="mysql-last-sql"
                        title={tr("mysql.page.copyCurrentSql")}
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(activeTableData.lastSql ?? "")
                            .then(() => setTableSqlCopied(true))
                            .catch(() => undefined);
                        }}
                      >
                        <span className="mysql-last-sql-label">{tableSqlCopied ? tr("mysql.page.copiedSql") : tr("mysql.page.currentSqlClickCopy")}</span>
                        <span className="mysql-last-sql-text">{activeTableData.lastSql}</span>
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          ) : activeBrowseTab?.kind === "query" ? (
            <div className="mysql-data-view">
              <div className="mysql-data-grid-wrap mysql-query-editor-wrap">
                <div className="mysql-query-toolbar">
                  <span className="mysql-table-empty">{tr("mysql.page.currentDatabase", { schema: activeBrowseTab.schema })}</span>
                  <button className="btn btn-ghost" onClick={props.onFormatSql}>{tr("mysql.page.formatSql")}</button>
                  <button className="btn btn-ghost" disabled={activeQueryEditor?.explaining} onClick={props.onExplainSql}>{activeQueryEditor?.explaining ? tr("mysql.page.explaining") : tr("mysql.page.explain")}</button>
                  <button className="btn" disabled={activeQueryEditor?.running} onClick={props.onRunSql}>{activeQueryEditor?.running ? tr("mysql.page.running") : tr("mysql.page.runSql")}</button>
                </div>
                <textarea
                  ref={queryEditorRef}
                  className="mysql-field mysql-query-editor"
                  value={activeQueryEditor?.sql ?? ""}
                  onChange={(event) => props.onSqlEditorChange(event.target.value, event.target.selectionStart ?? event.target.value.length, event.target)}
                  onClick={(event) => props.onSqlEditorClick(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)}
                  onKeyUp={(event) => props.onSqlEditorKeyUp(event.key, event.currentTarget.value, event.currentTarget.selectionStart ?? 0, event.currentTarget)}
                  onKeyDown={(event) => props.onSqlEditorKeyDown(event.key)}
                  onBlur={props.onSqlEditorBlur}
                  spellCheck={false}
                />
                {activeSuggestionItems.length > 0 ? (
                  <div className="mysql-sql-suggest-list" style={{ left: `${Math.max(8, querySuggestions?.x ?? 8)}px`, top: `${Math.max(8, querySuggestions?.y ?? 8)}px` }}>
                    {activeSuggestionItems.map((item, idx) => (
                      <button
                        key={item}
                        className={`mysql-sql-suggest-item${idx === suggestionActiveIndex ? " is-active" : ""}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => undefined}
                        onClick={() => props.onApplySuggestion(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                ) : null}
                {activeQueryEditor?.error ? <div className="mysql-table-empty">{activeQueryEditor.error}</div> : null}
                {activeQueryEditor?.result ? (
                  <>
                    <div className="mysql-data-table-scroll">
                      <div className="mysql-data-summary">
                        {tr("mysql.page.queryResultSummary", {
                          affected: activeQueryEditor.result.affected_rows,
                          page: queryResultPage + 1,
                          rows: queryResultPagedRows.length,
                          pageSize: queryResultPageSize,
                        })}
                      </div>
                      <MySqlDataGrid columns={activeQueryEditor.result.columns} rows={queryResultPagedRows} />
                    </div>
                    <div className="mysql-table-pagination">
                      <span className="mysql-data-summary mysql-table-pagination-summary">{tr("mysql.page.queryResultTotal", { total: queryResultTotal })}</span>
                      <select
                        className="mysql-field mysql-select mysql-table-page-size"
                        value={queryResultPageSize}
                        onChange={(event) => {
                          setQueryResultPageSize(Number(event.target.value));
                          setQueryResultPage(0);
                        }}
                      >
                        {[50, 100, 200, 500, 1000].map((size) => (
                          <option key={size} value={size}>
                            {tr("mysql.page.perPage", { size })}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn btn-ghost mysql-table-page-btn"
                        disabled={queryResultPage <= 0}
                        onClick={() => setQueryResultPage((prev) => Math.max(0, prev - 1))}
                      >
                        {tr("mysql.page.prevPage")}
                      </button>
                      <span className="mysql-table-empty mysql-table-pagination-text">
                        {queryResultPage + 1} / {Math.max(1, Math.ceil(queryResultTotal / queryResultPageSize))}
                      </span>
                      <input
                        className="mysql-field mysql-table-page-jump"
                        type="number"
                        min={1}
                        max={Math.max(1, Math.ceil(queryResultTotal / queryResultPageSize))}
                        value={queryResultJumpPage}
                        onChange={(event) => setQueryResultJumpPage(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          const totalPages = Math.max(1, Math.ceil(queryResultTotal / queryResultPageSize));
                          const raw = Number.parseInt(queryResultJumpPage, 10);
                          if (!Number.isFinite(raw)) return;
                          const target = Math.min(totalPages, Math.max(1, raw));
                          setQueryResultPage(target - 1);
                          setQueryResultJumpPage(String(target));
                        }}
                        placeholder={tr("mysql.page.pagePlaceholder")}
                      />
                      <button
                        className="btn btn-ghost mysql-table-page-btn"
                        onClick={() => {
                          const totalPages = Math.max(1, Math.ceil(queryResultTotal / queryResultPageSize));
                          const raw = Number.parseInt(queryResultJumpPage, 10);
                          if (!Number.isFinite(raw)) return;
                          const target = Math.min(totalPages, Math.max(1, raw));
                          setQueryResultPage(target - 1);
                          setQueryResultJumpPage(String(target));
                        }}
                      >
                        {tr("mysql.page.jump")}
                      </button>
                      <button
                        className="btn btn-ghost mysql-table-page-btn"
                        disabled={(queryResultPage + 1) * queryResultPageSize >= queryResultTotal}
                        onClick={() => setQueryResultPage((prev) => prev + 1)}
                      >
                        {tr("mysql.page.nextPage")}
                      </button>
                    </div>
                  </>
                ) : null}
                {activeQueryEditor?.explainResult ? (
                  <div className="mysql-data-table-scroll">
                    <div className="mysql-data-summary">{tr("mysql.page.explainResult")}</div>
                    <MySqlDataGrid columns={activeQueryEditor.explainResult.columns} rows={activeQueryEditor.explainResult.rows} />
                  </div>
                ) : null}
              </div>
            </div>
          ) : activeBrowseTab?.kind === "table-edit" ? (
            <div className="mysql-data-view">
              <div className="mysql-data-grid-wrap">
                <MySqlTableDesignEditor connectionId={props.selectedConnectionId} schema={activeBrowseTab.schema} table={activeBrowseTab.table ?? ""} />
              </div>
            </div>
          ) : (
            <div className="mysql-table-panel">
              <h4>{tr("mysql.page.tablePanelTitle")}</h4>
              <div className="mysql-table-list">
                {tablesLoading ? <div className="mysql-table-empty">{tr("sftp.loading")}</div> : null}
                {!tablesLoading && tables.length === 0 ? <div className="mysql-table-empty">{tr("mysql.page.selectDbToViewTables")}</div> : null}
                {tables.map((table) => (
                  <button
                    key={table.name}
                    className={`mysql-table-item ${activeTable === table.name ? "is-selected" : ""}`}
                    onClick={() => props.onSelectTable(table.name)}
                    onDoubleClick={() => props.onOpenTableTab(activeSchema, table.name)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setTableContextMenu({ x: event.clientX, y: event.clientY, table: table.name });
                    }}
                  >
                    {table.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {tableContextMenu ? (
        <div className="mysql-context-menu" style={{ left: tableContextMenu.x, top: tableContextMenu.y }}>
          <button
            className="mysql-context-item"
            onClick={() => {
              props.onOpenTableEdit(activeSchema, tableContextMenu.table);
              setTableContextMenu(null);
            }}
          >
            {tr("mysql.page.editTable")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
