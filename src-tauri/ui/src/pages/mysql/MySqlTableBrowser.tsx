import { useCallback, useEffect, useRef, useState } from "react";
import type { I18nKey } from "../../i18n";
import { mySqlExecuteQuery } from "../../services/bridge";
import { MySqlDataGrid } from "./MySqlDataGrid";
import { escapeSqlIdentifier, escapeSqlValue } from "./sqlUtils";
import type {
  MySqlBrowseTab,
  MySqlFilterCondition,
  MySqlFilterOperator,
  MySqlTableDataState,
} from "./types";

interface Props {
  activeBrowseTab: MySqlBrowseTab | null;
  activeTableData?: MySqlTableDataState;
  selectedConnectionId?: string;
  filterOperators: Array<{ value: MySqlFilterOperator; label: string }>;
  dataScrollRef: React.RefObject<HTMLDivElement>;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onChangeCondition: (conditionId: string, patch: Partial<MySqlFilterCondition>) => void;
  onDeleteCondition: (conditionId: string) => void;
  onAddCondition: () => void;
  onQueryTable: () => void;
  onChangeTablePage: (page: number) => void;
  onChangePageSize: (pageSize: number) => void;
}

export function MySqlTableBrowser({
  activeBrowseTab,
  activeTableData,
  selectedConnectionId,
  filterOperators,
  dataScrollRef,
  tr,
  onChangeCondition,
  onDeleteCondition,
  onAddCondition,
  onQueryTable,
  onChangeTablePage,
  onChangePageSize,
}: Props) {
  // ---- Inline cell editing state ----
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ---- Row selection ----
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [sqlCopiedFeedback, setSqlCopiedFeedback] = useState(false);
  const sqlCopiedTimer = useRef<ReturnType<typeof setTimeout>>();

  // ---- Insert modal ----
  const [showInsertModal, setShowInsertModal] = useState(false);
  const [insertForm, setInsertForm] = useState<Record<string, string>>({});
  const [inserting, setInserting] = useState(false);
  const [tableJumpPage, setTableJumpPage] = useState("");

  // Clear row selection on data reload
  useEffect(() => {
    setSelectedRow(null);
  }, [activeTableData?.rows]);

  useEffect(() => {
    if (!sqlCopiedFeedback) return;
    sqlCopiedTimer.current = setTimeout(() => setSqlCopiedFeedback(false), 2000);
    return () => clearTimeout(sqlCopiedTimer.current);
  }, [sqlCopiedFeedback]);

  // Clear edits when data reloads (pagination, filter change, etc.)
  useEffect(() => {
    setEdits({});
    setSaveError(null);
  }, [activeTableData?.rows]);

  const handleCellEdit = useCallback((rowIndex: number, colIndex: number, newValue: string) => {
    const originalValue = activeTableData?.rows[rowIndex]?.[colIndex] ?? null;
    const noChange =
      (originalValue === null && newValue === "") ||
      (originalValue !== null && newValue === originalValue);
    setEdits((prev) => {
      const key = `${rowIndex}:${colIndex}`;
      const next = { ...prev };
      if (noChange) {
        delete next[key];
      } else {
        next[key] = newValue;
      }
      return next;
    });
    setSaveError(null);
  }, [activeTableData]);

  const handleSaveChanges = useCallback(async () => {
    if (!selectedConnectionId || !activeBrowseTab?.schema || !activeBrowseTab?.table) return;
    const editEntries = Object.entries(edits);
    if (editEntries.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const columns = activeTableData?.columns ?? [];
      const columnInfos = activeTableData?.columnInfos ?? [];
      const pkColumns = columnInfos
        .filter((col) => col.column_key === "PRI")
        .map((col) => col.name);
      const pkSet = new Set(pkColumns);
      const rowEdits: Record<number, Array<{ colIdx: number; colName: string; newVal: string }>> = {};
      for (const [key, value] of editEntries) {
        const [rowStr, colStr] = key.split(":");
        const rowIdx = Number(rowStr);
        const colIdx = Number(colStr);
        const colName = columns[colIdx];
        if (colName === undefined) continue;
        if (!rowEdits[rowIdx]) rowEdits[rowIdx] = [];
        rowEdits[rowIdx].push({ colIdx, colName, newVal: value });
      }
      for (const [rowIdxStr, setClauses] of Object.entries(rowEdits)) {
        const rowIdx = Number(rowIdxStr);
        const rowData = activeTableData?.rows[rowIdx];
        if (!rowData) continue;
        const setSql = setClauses
          .map(({ colName, newVal }) =>
            `\`${escapeSqlIdentifier(colName)}\` = '${escapeSqlValue(newVal)}'`
          )
          .join(", ");
        const whereParts: string[] = [];
        if (pkColumns.length > 0) {
          for (const pkCol of pkColumns) {
            const colIdx = columns.indexOf(pkCol);
            if (colIdx < 0) continue;
            const origVal = rowData[colIdx];
            if (origVal === null) {
              whereParts.push(`\`${escapeSqlIdentifier(pkCol)}\` IS NULL`);
            } else {
              whereParts.push(`\`${escapeSqlIdentifier(pkCol)}\` = '${escapeSqlValue(origVal)}'`);
            }
          }
          for (const { colName } of setClauses) {
            if (pkSet.has(colName)) continue;
            const colIdx = columns.indexOf(colName);
            if (colIdx < 0) continue;
            const origVal = rowData[colIdx];
            if (origVal === null) {
              whereParts.push(`\`${escapeSqlIdentifier(colName)}\` IS NULL`);
            } else {
              whereParts.push(`\`${escapeSqlIdentifier(colName)}\` = '${escapeSqlValue(origVal)}'`);
            }
          }
        } else {
          // No PK detected: use an id column if it exists, otherwise all columns
          const idCol = columns.find((c) => c.toLowerCase() === "id");
          if (idCol) {
            const colIdx = columns.indexOf(idCol);
            const origVal = rowData[colIdx];
            if (origVal === null) {
              whereParts.push(`\`${escapeSqlIdentifier(idCol)}\` IS NULL`);
            } else {
              whereParts.push(`\`${escapeSqlIdentifier(idCol)}\` = '${escapeSqlValue(origVal)}'`);
            }
          } else {
            for (let i = 0; i < columns.length; i++) {
              const origVal = rowData[i];
              if (origVal === null) {
                whereParts.push(`\`${escapeSqlIdentifier(columns[i])}\` IS NULL`);
              } else {
                whereParts.push(`\`${escapeSqlIdentifier(columns[i])}\` = '${escapeSqlValue(origVal)}'`);
              }
            }
          }
        }
        const whereSql = whereParts.join(" AND ");
        const updateSql = `UPDATE \`${escapeSqlIdentifier(activeBrowseTab.schema)}\`.\`${escapeSqlIdentifier(activeBrowseTab.table)}\` SET ${setSql} WHERE ${whereSql}`;
        // eslint-disable-next-line no-await-in-loop
        const result = await mySqlExecuteQuery(selectedConnectionId, updateSql);
        if (result.affected_rows === 0) {
          throw new Error(`Row ${rowIdx + 1}: UPDATE affected 0 rows. SQL: ${updateSql}`);
        }
      }
      setEdits({});
      setSaveError(null);
      onQueryTable();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }, [edits, activeTableData, selectedConnectionId, activeBrowseTab, onQueryTable]);

  const handleDiscardEdits = useCallback(() => {
    setEdits({});
    setSaveError(null);
  }, []);

  // ---- Row SQL generation ----
  const generateInsertSql = useCallback((rowIndex: number) => {
    const columns = activeTableData?.columns ?? [];
    const rowData = activeTableData?.rows[rowIndex];
    if (!rowData || columns.length === 0) return "";
    const colList = columns.map((c) => `\`${escapeSqlIdentifier(c)}\``).join(", ");
    const valList = rowData
      .map((v) => (v === null ? "NULL" : `'${escapeSqlValue(v)}'`))
      .join(", ");
    if (!activeBrowseTab) return "";
    return `INSERT INTO \`${escapeSqlIdentifier(activeBrowseTab.schema)}\`.\`${escapeSqlIdentifier(activeBrowseTab.table)}\` (${colList}) VALUES (${valList});`;
  }, [activeTableData, activeBrowseTab]);

  const generateUpdateSql = useCallback((rowIndex: number) => {
    const columns = activeTableData?.columns ?? [];
    const columnInfos = activeTableData?.columnInfos ?? [];
    const rowData = activeTableData?.rows[rowIndex];
    if (!rowData || columns.length === 0) return "";
    if (!activeBrowseTab) return "";
    const setSql = columns
      .map((col, i) => {
        const v = rowData[i];
        return `\`${escapeSqlIdentifier(col)}\` = ${v === null ? "NULL" : `'${escapeSqlValue(v)}'`}`;
      })
      .join(", ");
    const pkColumns = columnInfos.filter((c) => c.column_key === "PRI").map((c) => c.name);
    let whereSql: string;
    if (pkColumns.length > 0) {
      whereSql = pkColumns
        .map((pk) => {
          const idx = columns.indexOf(pk);
          if (idx < 0) return null;
          const v = rowData[idx];
          return v === null ? `\`${escapeSqlIdentifier(pk)}\` IS NULL` : `\`${escapeSqlIdentifier(pk)}\` = '${escapeSqlValue(v)}'`;
        })
        .filter(Boolean)
        .join(" AND ");
    } else {
      const idCol = columns.find((c) => c.toLowerCase() === "id");
      if (idCol) {
        const idx = columns.indexOf(idCol);
        const v = rowData[idx];
        whereSql = v === null ? `\`${escapeSqlIdentifier(idCol)}\` IS NULL` : `\`${escapeSqlIdentifier(idCol)}\` = '${escapeSqlValue(v)}'`;
      } else {
        whereSql = columns
          .map((col, i) => {
            const v = rowData[i];
            return v === null ? `\`${escapeSqlIdentifier(col)}\` IS NULL` : `\`${escapeSqlIdentifier(col)}\` = '${escapeSqlValue(v)}'`;
          })
          .join(" AND ");
      }
    }
    return `UPDATE \`${escapeSqlIdentifier(activeBrowseTab.schema)}\`.\`${escapeSqlIdentifier(activeBrowseTab.table)}\` SET ${setSql} WHERE ${whereSql};`;
  }, [activeTableData, activeBrowseTab]);

  const handleCopyInsert = useCallback(() => {
    if (selectedRow === null) return;
    const sql = generateInsertSql(selectedRow);
    if (!sql) return;
    void navigator.clipboard.writeText(sql).then(() => setSqlCopiedFeedback(true)).catch(() => undefined);
  }, [selectedRow, generateInsertSql]);

  const handleCopyUpdate = useCallback(() => {
    if (selectedRow === null) return;
    const sql = generateUpdateSql(selectedRow);
    if (!sql) return;
    void navigator.clipboard.writeText(sql).then(() => setSqlCopiedFeedback(true)).catch(() => undefined);
  }, [selectedRow, generateUpdateSql]);

  // ---- Insert modal ----
  const handleOpenInsertModal = useCallback(() => {
    const columns = activeTableData?.columns ?? [];
    const form: Record<string, string> = {};
    for (const col of columns) form[col] = "";
    setInsertForm(form);
    setShowInsertModal(true);
  }, [activeTableData]);

  const handleInsertRow = useCallback(async () => {
    if (!selectedConnectionId || !activeBrowseTab?.schema || !activeBrowseTab?.table) return;
    setInserting(true);
    try {
      const columns = activeTableData?.columns ?? [];
      const colList = columns.map((c) => `\`${escapeSqlIdentifier(c)}\``).join(", ");
      const valList = columns
        .map((col) => {
          const v = insertForm[col] ?? "";
          return v === "" ? "NULL" : `'${escapeSqlValue(v)}'`;
        })
        .join(", ");
      const sql = `INSERT INTO \`${escapeSqlIdentifier(activeBrowseTab.schema)}\`.\`${escapeSqlIdentifier(activeBrowseTab.table)}\` (${colList}) VALUES (${valList});`;
      await mySqlExecuteQuery(selectedConnectionId, sql);
      setShowInsertModal(false);
      setInsertForm({});
      onQueryTable();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSaveError(tr("mysql.page.insertFailed", { message }));
    } finally {
      setInserting(false);
    }
  }, [selectedConnectionId, activeBrowseTab, activeTableData, insertForm, onQueryTable, tr]);

  const [tableSqlCopied, setTableSqlCopied] = useState(false);

  useEffect(() => {
    if (!tableSqlCopied) return;
    const timer = window.setTimeout(() => setTableSqlCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [tableSqlCopied]);

  return (
    <div className="mysql-data-view">
      <div className="mysql-data-grid-wrap">
        <div className="mysql-data-filter-bar">
          <div className="mysql-data-filter-list">
            {(activeTableData?.conditions ?? []).map((condition, _, allConditions) => {
              const takenColumns = new Set(allConditions.filter((c) => c.id !== condition.id).map((c) => c.column).filter(Boolean));
              return (
                <div key={condition.id} className="mysql-data-filter-row">
                  <select className="mysql-field mysql-select mysql-data-filter-select" value={condition.column} onChange={(event) => onChangeCondition(condition.id, { column: event.target.value })}>
                    <option value="">{tr("mysql.page.selectColumn")}</option>
                    {(activeTableData?.columns ?? []).map((column) => (
                      <option key={column} value={column} disabled={takenColumns.has(column)}>{column}</option>
                    ))}
                  </select>
                  <select className="mysql-field mysql-select mysql-data-filter-op" value={condition.operator} onChange={(event) => onChangeCondition(condition.id, { operator: event.target.value as MySqlFilterOperator })}>
                    {filterOperators.map((operator) => (
                      <option key={operator.value} value={operator.value}>{operator.label}</option>
                    ))}
                  </select>
                  <input
                    className="mysql-field mysql-data-filter-input"
                    value={condition.value}
                    onChange={(event) => onChangeCondition(condition.id, { value: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") onQueryTable();
                    }}
                    placeholder={tr("mysql.page.filterValuePlaceholder")}
                  />
                  <button className="btn btn-ghost" onClick={() => onDeleteCondition(condition.id)}>{tr("session.delete")}</button>
                </div>
              );
            })}
          </div>
          <div className="mysql-data-filter-actions">
            <button className="btn btn-ghost" onClick={onAddCondition}>{tr("mysql.page.addCondition")}</button>
            <button className="btn" onClick={onQueryTable}>{tr("mysql.page.queryDatabase")}</button>
          </div>
        </div>
        <div className="mysql-data-row-actions">
          <button className="btn btn-ghost" onClick={handleOpenInsertModal}>{tr("mysql.page.addRow")}</button>
          {selectedRow !== null ? (
            <>
              <button className="btn btn-ghost" onClick={handleCopyInsert}>{tr("mysql.page.copyInsert")}</button>
              <button className="btn btn-ghost" onClick={handleCopyUpdate}>{tr("mysql.page.copyUpdate")}</button>
            </>
          ) : null}
          {sqlCopiedFeedback ? <span className="mysql-edit-summary">{tr("mysql.page.sqlCopied")}</span> : null}
        </div>
        {Object.keys(edits).length > 0 ? (
          <div className="mysql-edit-toolbar">
            <span className="mysql-edit-summary">{tr("mysql.page.modifiedCells", { count: Object.keys(edits).length })}</span>
            <button className="btn btn-ghost" disabled={saving} onClick={handleDiscardEdits}>{tr("mysql.page.discardEdits")}</button>
            <button className="btn" disabled={saving} onClick={handleSaveChanges}>{saving ? tr("mysql.page.savingEdits") : tr("mysql.page.saveChanges")}</button>
          </div>
        ) : null}
        {saveError ? <div className="mysql-edit-error">{tr("mysql.page.saveEditsFailed", { message: saveError })}</div> : null}
        {activeTableData?.loading ? <div className="mysql-table-empty">{tr("sftp.loading")}</div> : null}
        {activeTableData?.error ? <div className="mysql-table-empty">{activeTableData.error}</div> : null}
        {!activeTableData?.loading && !activeTableData?.error ? (
          <>
            <div className="mysql-data-table-scroll" ref={dataScrollRef}>
              <MySqlDataGrid columns={activeTableData?.columns ?? []} rows={activeTableData?.rows ?? []} columnTypes={Object.fromEntries((activeTableData?.columnInfos ?? []).map((c) => [c.name, c.column_type]))} edits={edits} onCellEdit={handleCellEdit} selectedRow={selectedRow ?? undefined} onSelectRow={setSelectedRow} />
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
                  onChange={(event) => onChangePageSize(Number(event.target.value))}
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
                  onClick={() => onChangeTablePage(Math.max(0, (activeTableData?.page ?? 0) - 1))}
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
                    onChangeTablePage(target - 1);
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
                    onChangeTablePage(target - 1);
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
                  onClick={() => onChangeTablePage((activeTableData?.page ?? 0) + 1)}
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
      {showInsertModal ? (
        <div className="mysql-insert-overlay" onClick={() => setShowInsertModal(false)}>
          <div className="mysql-insert-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mysql-insert-modal-header">{tr("mysql.page.insertRow")}</div>
            <div className="mysql-insert-modal-body">
              {(activeTableData?.columns ?? []).map((col) => (
                <div key={col} className="mysql-insert-field">
                  <label className="mysql-insert-label">{col}</label>
                  <input
                    className="mysql-field"
                    value={insertForm[col] ?? ""}
                    onChange={(e) => setInsertForm((prev) => ({ ...prev, [col]: e.target.value }))}
                    placeholder={col}
                  />
                </div>
              ))}
            </div>
            <div className="mysql-insert-modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowInsertModal(false)} disabled={inserting}>{tr("session.cancel")}</button>
              <button className="btn" onClick={handleInsertRow} disabled={inserting}>{inserting ? tr("mysql.page.savingEdits") : tr("mysql.page.saveChanges")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
