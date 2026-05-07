import { useEffect, useMemo, useState } from "react";
import type { I18nKey } from "../../i18n";
import { MySqlDataGrid } from "./MySqlDataGrid";
import type {
  MySqlBrowseTab,
  MySqlQueryEditorState,
  SqlSuggestionState,
} from "./types";

interface Props {
  activeBrowseTab: MySqlBrowseTab | null;
  activeQueryEditor?: MySqlQueryEditorState;
  querySuggestions: SqlSuggestionState | null;
  activeSuggestionItems: string[];
  suggestionActiveIndex: number;
  queryEditorRef: React.RefObject<HTMLTextAreaElement>;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onFormatSql: () => void;
  onExplainSql: () => void;
  onRunSql: () => void;
  onChangeQueryOffset: (offset: number) => void;
  onSqlEditorChange: (value: string, cursor: number, textarea: HTMLTextAreaElement) => void;
  onSqlEditorClick: (value: string, cursor: number) => void;
  onSqlEditorKeyUp: (key: string, value: string, cursor: number, textarea: HTMLTextAreaElement) => void;
  onSqlEditorKeyDown: (key: string) => void;
  onSqlEditorBlur: () => void;
  onApplySuggestion: (item: string) => void;
}

export function MySqlQueryBrowser({
  activeBrowseTab,
  activeQueryEditor,
  querySuggestions,
  activeSuggestionItems,
  suggestionActiveIndex,
  queryEditorRef,
  tr,
  onFormatSql,
  onExplainSql,
  onRunSql,
  onChangeQueryOffset,
  onSqlEditorChange,
  onSqlEditorClick,
  onSqlEditorKeyUp,
  onSqlEditorKeyDown,
  onSqlEditorBlur,
  onApplySuggestion,
}: Props) {
  const [queryResultPage, setQueryResultPage] = useState(0);
  const [queryResultPageSize, setQueryResultPageSize] = useState(100);
  const [queryResultJumpPage, setQueryResultJumpPage] = useState("");

  const queryResultRows = activeQueryEditor?.result?.rows ?? [];
  const queryBufferOffset = activeQueryEditor?.queryOffset ?? 0;
  const queryLimit = activeQueryEditor?.queryLimit ?? 200;
  const queryResultTotal = queryResultRows.length;
  const queryResultPagedRows = useMemo(() => {
    const offset = queryResultPage * queryResultPageSize;
    return queryResultRows.slice(offset, offset + queryResultPageSize);
  }, [queryResultPage, queryResultPageSize, queryResultRows]);
  const mayHaveMoreRows = queryResultRows.length >= queryLimit;

  useEffect(() => {
    setQueryResultPage(0);
    setQueryResultJumpPage("");
  }, [activeBrowseTab?.id, activeQueryEditor?.result]);

  return (
    <div className="mysql-data-view">
      <div className="mysql-data-grid-wrap mysql-query-editor-wrap">
        <div className="mysql-query-toolbar">
          <span className="mysql-table-empty">{tr("mysql.page.currentDatabase", { schema: activeBrowseTab?.schema ?? "" })}</span>
          <button className="btn btn-ghost" onClick={onFormatSql}>{tr("mysql.page.formatSql")}</button>
          <button className="btn btn-ghost" disabled={activeQueryEditor?.explaining} onClick={onExplainSql}>{activeQueryEditor?.explaining ? tr("mysql.page.explaining") : tr("mysql.page.explain")}</button>
          <button className="btn" disabled={activeQueryEditor?.running} onClick={onRunSql}>{activeQueryEditor?.running ? tr("mysql.page.running") : tr("mysql.page.runSql")}</button>
        </div>
        <textarea
          ref={queryEditorRef}
          className="mysql-field mysql-query-editor"
          value={activeQueryEditor?.sql ?? ""}
          onChange={(event) => onSqlEditorChange(event.target.value, event.target.selectionStart ?? event.target.value.length, event.target)}
          onClick={(event) => onSqlEditorClick(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)}
          onKeyUp={(event) => onSqlEditorKeyUp(event.key, event.currentTarget.value, event.currentTarget.selectionStart ?? 0, event.currentTarget)}
          onKeyDown={(event) => onSqlEditorKeyDown(event.key)}
          onBlur={onSqlEditorBlur}
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
                onClick={() => onApplySuggestion(item)}
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
                {queryBufferOffset > 0
                  ? tr("mysql.page.queryResultSummary", {
                      affected: activeQueryEditor.result.affected_rows,
                      page: queryBufferOffset / queryLimit + 1,
                      rows: queryResultPagedRows.length,
                      pageSize: queryResultPageSize,
                    })
                  : tr("mysql.page.queryResultSummary", {
                      affected: activeQueryEditor.result.affected_rows,
                      page: queryResultPage + 1,
                      rows: queryResultPagedRows.length,
                      pageSize: queryResultPageSize,
                    })}
                {queryBufferOffset > 0
                  ? ` (offset ${queryBufferOffset})`
                  : ""}
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
                disabled={queryResultPage <= 0 && queryBufferOffset <= 0}
                onClick={() => {
                  if (queryResultPage > 0) {
                    setQueryResultPage((prev) => prev - 1);
                  } else if (queryBufferOffset > 0) {
                    const prevOffset = Math.max(0, queryBufferOffset - queryLimit);
                    setQueryResultPage(Math.ceil(queryLimit / queryResultPageSize) - 1);
                    onChangeQueryOffset(prevOffset);
                  }
                }}
              >
                {tr("mysql.page.prevPage")}
              </button>
              <span className="mysql-table-empty mysql-table-pagination-text">
                {queryBufferOffset > 0
                  ? `${queryBufferOffset + 1}-${queryBufferOffset + queryResultTotal}`
                  : `${queryResultPage * queryResultPageSize + 1}-${queryResultPage * queryResultPageSize + queryResultPagedRows.length}`}
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
                disabled={(queryResultPage + 1) * queryResultPageSize >= queryResultTotal && !mayHaveMoreRows}
                onClick={() => {
                  if ((queryResultPage + 1) * queryResultPageSize < queryResultTotal) {
                    setQueryResultPage((prev) => prev + 1);
                  } else if (mayHaveMoreRows) {
                    setQueryResultPage(0);
                    onChangeQueryOffset(queryBufferOffset + queryLimit);
                  }
                }}
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
  );
}
