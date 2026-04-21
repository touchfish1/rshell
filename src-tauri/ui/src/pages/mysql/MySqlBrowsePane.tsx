import { useEffect, useMemo, useState, type RefObject } from "react";
import type { MySqlTableInfo } from "../../services/types";
import { MySqlDataGrid } from "./MySqlDataGrid";
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
  onSelectTab: (tab: MySqlBrowseTab) => void;
  onSelectTable: (table: string) => void;
  onOpenTableTab: (schema: string, table: string) => void;
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
  } = props;
  const [queryResultPage, setQueryResultPage] = useState(0);
  const [queryResultPageSize, setQueryResultPageSize] = useState(100);
  const queryResultRows = activeQueryEditor?.result?.rows ?? [];
  const queryResultTotal = queryResultRows.length;
  const queryResultPagedRows = useMemo(() => {
    const offset = queryResultPage * queryResultPageSize;
    return queryResultRows.slice(offset, offset + queryResultPageSize);
  }, [queryResultPage, queryResultPageSize, queryResultRows]);

  useEffect(() => {
    setQueryResultPage(0);
  }, [activeBrowseTab?.id, activeQueryEditor?.result]);

  return (
    <div className="redis-browser-pane">
      <div className="redis-browser-toolbar mysql-browse-tabs">
        {browseTabs.length === 0 ? <div className="mysql-toolbar-label">双击库/表后在这里显示 tab 列表</div> : null}
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
                          <option value="">选择列</option>
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
                          placeholder="筛选值"
                        />
                        <button className="btn btn-ghost" onClick={() => props.onDeleteCondition(condition.id)}>删除</button>
                      </div>
                    ))}
                  </div>
                  <div className="mysql-data-filter-actions">
                    <button className="btn btn-ghost" onClick={props.onAddCondition}>添加条件</button>
                    <button className="btn" onClick={props.onQueryTable}>查询数据库</button>
                  </div>
                </div>
                {activeTableData?.loading ? <div className="mysql-table-empty">加载数据中...</div> : null}
                {activeTableData?.error ? <div className="mysql-table-empty">{activeTableData.error}</div> : null}
                {!activeTableData?.loading && !activeTableData?.error ? (
                  <>
                    <div className="mysql-data-table-scroll" ref={dataScrollRef}>
                      <MySqlDataGrid columns={activeTableData?.columns ?? []} rows={activeTableData?.rows ?? []} />
                    </div>
                    {(activeTableData?.totalRows ?? 0) > (activeTableData?.pageSize ?? 100) ? (
                      <div className="mysql-table-pagination">
                        <span className="mysql-data-summary mysql-table-pagination-summary">
                          当前第 {((activeTableData?.page ?? 0) + 1)} 页，返回 {activeTableData?.rows.length ?? 0} 行（每页 {activeTableData?.pageSize ?? 100} 行）
                        </span>
                        <select
                          className="mysql-field mysql-select mysql-table-page-size"
                          value={activeTableData?.pageSize ?? 100}
                          onChange={(event) => props.onChangePageSize(Number(event.target.value))}
                        >
                          {[50, 100, 200, 500, 1000].map((size) => (
                            <option key={size} value={size}>
                              {size}/页
                            </option>
                          ))}
                        </select>
                        <button
                          className="btn btn-ghost mysql-table-page-btn"
                          disabled={(activeTableData?.page ?? 0) <= 0 || Boolean(activeTableData?.loading)}
                          onClick={() => props.onChangeTablePage(Math.max(0, (activeTableData?.page ?? 0) - 1))}
                        >
                          上一页
                        </button>
                        <span className="mysql-table-empty mysql-table-pagination-text">
                          {((activeTableData?.page ?? 0) + 1)} / {Math.max(1, Math.ceil((activeTableData?.totalRows ?? 0) / (activeTableData?.pageSize ?? 100)))}
                        </span>
                        <button
                          className="btn btn-ghost mysql-table-page-btn"
                          disabled={
                            Boolean(activeTableData?.loading) ||
                            (((activeTableData?.page ?? 0) + 1) * (activeTableData?.pageSize ?? 100) >= (activeTableData?.totalRows ?? 0))
                          }
                          onClick={() => props.onChangeTablePage((activeTableData?.page ?? 0) + 1)}
                        >
                          下一页
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          ) : activeBrowseTab?.kind === "query" ? (
            <div className="mysql-data-view">
              <div className="mysql-data-grid-wrap mysql-query-editor-wrap">
                <div className="mysql-query-toolbar">
                  <span className="mysql-table-empty">当前数据库：{activeBrowseTab.schema}</span>
                  <button className="btn btn-ghost" onClick={props.onFormatSql}>美化 SQL</button>
                  <button className="btn btn-ghost" disabled={activeQueryEditor?.explaining} onClick={props.onExplainSql}>{activeQueryEditor?.explaining ? "EXPLAIN 中..." : "EXPLAIN"}</button>
                  <button className="btn" disabled={activeQueryEditor?.running} onClick={props.onRunSql}>{activeQueryEditor?.running ? "运行中..." : "运行 SQL"}</button>
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
                        执行结果：影响行数 {activeQueryEditor.result.affected_rows}，当前第 {queryResultPage + 1} 页，返回 {queryResultPagedRows.length} 行（每页 {queryResultPageSize} 行）
                      </div>
                      <MySqlDataGrid columns={activeQueryEditor.result.columns} rows={queryResultPagedRows} />
                    </div>
                    {queryResultTotal > queryResultPageSize ? (
                      <div className="mysql-table-pagination">
                        <span className="mysql-data-summary mysql-table-pagination-summary">查询结果共 {queryResultTotal} 行</span>
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
                              {size}/页
                            </option>
                          ))}
                        </select>
                        <button
                          className="btn btn-ghost mysql-table-page-btn"
                          disabled={queryResultPage <= 0}
                          onClick={() => setQueryResultPage((prev) => Math.max(0, prev - 1))}
                        >
                          上一页
                        </button>
                        <span className="mysql-table-empty mysql-table-pagination-text">
                          {queryResultPage + 1} / {Math.max(1, Math.ceil(queryResultTotal / queryResultPageSize))}
                        </span>
                        <button
                          className="btn btn-ghost mysql-table-page-btn"
                          disabled={(queryResultPage + 1) * queryResultPageSize >= queryResultTotal}
                          onClick={() => setQueryResultPage((prev) => prev + 1)}
                        >
                          下一页
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : null}
                {activeQueryEditor?.explainResult ? (
                  <div className="mysql-data-table-scroll">
                    <div className="mysql-data-summary">EXPLAIN 结果</div>
                    <MySqlDataGrid columns={activeQueryEditor.explainResult.columns} rows={activeQueryEditor.explainResult.rows} />
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mysql-table-panel">
              <h4>数据表（双击打开数据）</h4>
              <div className="mysql-table-list">
                {tablesLoading ? <div className="mysql-table-empty">加载中...</div> : null}
                {!tablesLoading && tables.length === 0 ? <div className="mysql-table-empty">点击左侧数据库查看表</div> : null}
                {tables.map((table) => (
                  <button key={table.name} className={`mysql-table-item ${activeTable === table.name ? "is-selected" : ""}`} onClick={() => props.onSelectTable(table.name)} onDoubleClick={() => props.onOpenTableTab(activeSchema, table.name)}>
                    {table.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
