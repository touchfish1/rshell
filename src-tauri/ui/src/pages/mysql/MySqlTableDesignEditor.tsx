import { useCallback, useEffect, useMemo, useState } from "react";
import { mySqlExecuteQuery } from "../../services/bridge";
import { escapeSqlIdentifier, escapeSqlValue } from "./sqlUtils";

type ColumnDraft = {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string;
  extra: string;
  comment: string;
  isNew: boolean;
  markedDrop: boolean;
  original?: Omit<ColumnDraft, "id" | "isNew" | "markedDrop" | "original">;
};

type IndexDraft = {
  id: string;
  name: string;
  kind: "PRIMARY" | "UNIQUE" | "INDEX";
  columns: string;
  method: string;
  isNew: boolean;
  markedDrop: boolean;
  original?: Omit<IndexDraft, "id" | "isNew" | "markedDrop" | "original">;
};

const PRESET_COLUMN_TYPES = [
  "bigint",
  "int",
  "smallint",
  "tinyint",
  "decimal(10,2)",
  "double",
  "varchar(255)",
  "char(32)",
  "text",
  "longtext",
  "datetime",
  "timestamp",
  "date",
  "time",
  "json",
];

interface Props {
  connectionId?: string;
  schema: string;
  table: string;
}

const nextId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function parseDefaultToken(raw: string): string {
  if (raw == null) return "";
  return String(raw);
}

function buildColumnDef(item: ColumnDraft): string {
  const nameSql = `\`${escapeSqlIdentifier(item.name.trim())}\``;
  const typeSql = item.type.trim();
  const nullableSql = item.nullable ? "NULL" : "NOT NULL";
  let defaultSql = "";
  const defaultText = item.defaultValue.trim();
  if (defaultText) {
    if (defaultText.toUpperCase() === "NULL") {
      defaultSql = " DEFAULT NULL";
    } else if (/^(CURRENT_TIMESTAMP(?:\(\))?)$/i.test(defaultText)) {
      defaultSql = ` DEFAULT ${defaultText}`;
    } else {
      defaultSql = ` DEFAULT '${escapeSqlValue(defaultText)}'`;
    }
  }
  const extraSql = item.extra.trim() ? ` ${item.extra.trim()}` : "";
  const commentSql = item.comment.trim() ? ` COMMENT '${escapeSqlValue(item.comment.trim())}'` : "";
  return `${nameSql} ${typeSql} ${nullableSql}${defaultSql}${extraSql}${commentSql}`;
}

function sameColumn(a?: ColumnDraft["original"], b?: ColumnDraft): boolean {
  if (!a || !b) return false;
  return (
    a.name === b.name &&
    a.type === b.type &&
    a.nullable === b.nullable &&
    a.defaultValue === b.defaultValue &&
    a.extra === b.extra &&
    a.comment === b.comment
  );
}

function sameIndex(a?: IndexDraft["original"], b?: IndexDraft): boolean {
  if (!a || !b) return false;
  return a.name === b.name && a.kind === b.kind && a.columns === b.columns && a.method === b.method;
}

function parseIndexColumns(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function MySqlTableDesignEditor({ connectionId, schema, table }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [tableComment, setTableComment] = useState("");
  const [originalTableComment, setOriginalTableComment] = useState("");
  const [columns, setColumns] = useState<ColumnDraft[]>([]);
  const [indexes, setIndexes] = useState<IndexDraft[]>([]);
  const [activeTab, setActiveTab] = useState<"columns" | "indexes">("columns");

  const loadMeta = useCallback(async () => {
    if (!connectionId) return;
    setLoading(true);
    setError(null);
    try {
      const columnMetaResult = await mySqlExecuteQuery(
        connectionId,
        `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA, COLUMN_DEFAULT, COLUMN_COMMENT
         FROM information_schema.columns
         WHERE TABLE_SCHEMA='${escapeSqlValue(schema)}' AND TABLE_NAME='${escapeSqlValue(table)}'
         ORDER BY ORDINAL_POSITION`,
        1000,
        0,
        schema
      );
      const idxResult = await mySqlExecuteQuery(
        connectionId,
        `SHOW INDEX FROM \`${escapeSqlIdentifier(schema)}\`.\`${escapeSqlIdentifier(table)}\``,
        1000,
        0,
        schema
      );
      const commentResult = await mySqlExecuteQuery(
        connectionId,
        `SELECT TABLE_COMMENT FROM information_schema.tables WHERE TABLE_SCHEMA='${escapeSqlValue(schema)}' AND TABLE_NAME='${escapeSqlValue(table)}' LIMIT 1`,
        1,
        0,
        schema
      );

      const nextColumns: ColumnDraft[] = columnMetaResult.rows.map((row) => {
        const name = row[0] ?? "";
        const colType = (row[1] ?? "").trim();
        const isNullable = (row[2] ?? "").toUpperCase() === "YES";
        const extra = row[4] ?? "";
        const defaultValue = row[5] ?? "";
        const comment = row[6] ?? "";
        const draft: ColumnDraft = {
          id: nextId(),
          name,
          type: colType,
          nullable: isNullable,
          defaultValue: parseDefaultToken(defaultValue),
          extra,
          comment,
          isNew: false,
          markedDrop: false,
        };
        draft.original = {
          name: draft.name,
          type: draft.type,
          nullable: draft.nullable,
          defaultValue: draft.defaultValue,
          extra: draft.extra,
          comment: draft.comment,
        };
        return draft;
      });

      const groupedIndexes = new Map<string, { kind: IndexDraft["kind"]; method: string; cols: Array<{ seq: number; col: string }> }>();
      idxResult.rows.forEach((row) => {
        const keyName = row[2] ?? "";
        const nonUnique = row[1] ?? "1";
        const seq = Number.parseInt(row[3] ?? "1", 10) || 1;
        const col = row[4] ?? "";
        const method = row[10] ?? "BTREE";
        const kind: IndexDraft["kind"] = keyName === "PRIMARY" ? "PRIMARY" : nonUnique === "0" ? "UNIQUE" : "INDEX";
        const existed = groupedIndexes.get(keyName) ?? { kind, method, cols: [] };
        existed.cols.push({ seq, col });
        groupedIndexes.set(keyName, existed);
      });
      const nextIndexes: IndexDraft[] = Array.from(groupedIndexes.entries()).map(([name, item]) => {
        const cols = item.cols.sort((a, b) => a.seq - b.seq).map((it) => it.col).join(", ");
        const draft: IndexDraft = {
          id: nextId(),
          name,
          kind: item.kind,
          columns: cols,
          method: item.method,
          isNew: false,
          markedDrop: false,
        };
        draft.original = {
          name: draft.name,
          kind: draft.kind,
          columns: draft.columns,
          method: draft.method,
        };
        return draft;
      });

      const comment = commentResult.rows?.[0]?.[0] ?? "";
      setColumns(nextColumns);
      setIndexes(nextIndexes);
      setTableComment(comment);
      setOriginalTableComment(comment);
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [connectionId, schema, table]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const canSave = useMemo(() => {
    if (!connectionId || saving || loading) return false;
    return true;
  }, [connectionId, loading, saving]);

  const columnTypeOptions = useMemo(() => {
    const set = new Set<string>(PRESET_COLUMN_TYPES);
    columns.forEach((col) => {
      if (col.type.trim()) set.add(col.type.trim());
    });
    return Array.from(set);
  }, [columns]);

  const availableIndexColumns = useMemo(
    () => columns.filter((col) => !col.markedDrop && col.name.trim()).map((col) => col.name.trim()),
    [columns]
  );

  const updateIndexColumns = (id: string, nextCols: string[]) => {
    setIndexes((prev) =>
      prev.map((idx) =>
        idx.id === id
          ? {
              ...idx,
              columns: nextCols.join(", "),
            }
          : idx
      )
    );
  };

  const saveAll = async () => {
    if (!connectionId) return;
    setSaving(true);
    setError(null);
    setMessage("");
    try {
      const sqlList: string[] = [];
      const tableSqlPrefix = `\`${escapeSqlIdentifier(schema)}\`.\`${escapeSqlIdentifier(table)}\``;

      columns.forEach((item) => {
        if (!item.name.trim() || !item.type.trim()) return;
        if (item.markedDrop && !item.isNew) {
          sqlList.push(`ALTER TABLE ${tableSqlPrefix} DROP COLUMN \`${escapeSqlIdentifier(item.original?.name ?? item.name)}\``);
          return;
        }
        if (item.markedDrop && item.isNew) return;
        if (item.isNew) {
          sqlList.push(`ALTER TABLE ${tableSqlPrefix} ADD COLUMN ${buildColumnDef(item)}`);
          return;
        }
        if (!sameColumn(item.original, item)) {
          sqlList.push(`ALTER TABLE ${tableSqlPrefix} MODIFY COLUMN ${buildColumnDef(item)}`);
        }
      });

      indexes.forEach((idx) => {
        const cols = idx.columns
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
          .map((c) => `\`${escapeSqlIdentifier(c)}\``)
          .join(", ");
        if (!cols) return;
        const indexNameSql = `\`${escapeSqlIdentifier(idx.name)}\``;
        if (idx.markedDrop && !idx.isNew) {
          if (idx.name !== "PRIMARY") {
            sqlList.push(`ALTER TABLE ${tableSqlPrefix} DROP INDEX ${indexNameSql}`);
          }
          return;
        }
        if (idx.markedDrop && idx.isNew) return;
        const addIndexSql =
          idx.kind === "PRIMARY"
            ? `ALTER TABLE ${tableSqlPrefix} ADD PRIMARY KEY (${cols})`
            : idx.kind === "UNIQUE"
              ? `ALTER TABLE ${tableSqlPrefix} ADD UNIQUE INDEX ${indexNameSql} (${cols})`
              : `ALTER TABLE ${tableSqlPrefix} ADD INDEX ${indexNameSql} (${cols})`;
        if (idx.isNew) {
          sqlList.push(addIndexSql);
          return;
        }
        if (!sameIndex(idx.original, idx)) {
          if (idx.name !== "PRIMARY") {
            sqlList.push(`ALTER TABLE ${tableSqlPrefix} DROP INDEX ${indexNameSql}`);
          }
          sqlList.push(addIndexSql);
        }
      });

      if (tableComment !== originalTableComment) {
        sqlList.push(`ALTER TABLE ${tableSqlPrefix} COMMENT='${escapeSqlValue(tableComment)}'`);
      }

      if (sqlList.length === 0) {
        setMessage("没有检测到变更");
        return;
      }

      for (const sql of sqlList) {
        await mySqlExecuteQuery(connectionId, sql, 1, 0, schema);
      }
      setMessage(`保存成功，已执行 ${sqlList.length} 条 SQL`);
      await loadMeta();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mysql-table-design">
      <div className="mysql-table-design-toolbar">
        <div className="mysql-table-design-title">{schema}.{table} 表结构编辑</div>
        <button className="btn btn-ghost" onClick={() => void loadMeta()} disabled={loading || saving}>
          {loading ? "加载中..." : "刷新结构"}
        </button>
        <button className="btn" onClick={() => void saveAll()} disabled={!canSave}>
          {saving ? "保存中..." : "保存变更"}
        </button>
      </div>
      <div className="mysql-table-design-tabbar">
        <button className={`btn btn-ghost ${activeTab === "columns" ? "is-active" : ""}`} onClick={() => setActiveTab("columns")}>
          字段
        </button>
        <button className={`btn btn-ghost ${activeTab === "indexes" ? "is-active" : ""}`} onClick={() => setActiveTab("indexes")}>
          索引
        </button>
      </div>
      {error ? <div className="mysql-table-empty">{error}</div> : null}
      {message ? <div className="mysql-data-summary">{message}</div> : null}

      {activeTab === "columns" ? (
        <div className="mysql-table-design-section">
          <div className="mysql-table-design-section-title">表备注</div>
          <input className="mysql-field" value={tableComment} onChange={(e) => setTableComment(e.target.value)} placeholder="表备注" />
        </div>
      ) : null}

      {activeTab === "columns" ? (
        <div className="mysql-table-design-section">
          <div className="mysql-table-design-section-title">字段</div>
          <div className="mysql-table-design-grid columns">
            {columns.map((col) => (
              <div key={col.id} className={`mysql-table-design-row ${col.markedDrop ? "is-drop" : ""}`}>
                <input className="mysql-field" value={col.name} onChange={(e) => setColumns((prev) => prev.map((x) => x.id === col.id ? { ...x, name: e.target.value } : x))} placeholder="字段名" />
                <select
                  className="mysql-field mysql-select"
                  value={col.type.trim()}
                  onChange={(e) => setColumns((prev) => prev.map((x) => (x.id === col.id ? { ...x, type: e.target.value } : x)))}
                >
                  <option value="" disabled>
                    选择类型
                  </option>
                  {col.type.trim() && !columnTypeOptions.includes(col.type.trim()) ? <option value={col.type.trim()}>{col.type.trim()}</option> : null}
                  {columnTypeOptions.map((typeName) => (
                    <option key={typeName} value={typeName}>
                      {typeName}
                    </option>
                  ))}
                </select>
                <input className="mysql-field" value={col.defaultValue} onChange={(e) => setColumns((prev) => prev.map((x) => x.id === col.id ? { ...x, defaultValue: e.target.value } : x))} placeholder="默认值（空表示无）" />
                <input className="mysql-field" value={col.comment} onChange={(e) => setColumns((prev) => prev.map((x) => x.id === col.id ? { ...x, comment: e.target.value } : x))} placeholder="字段备注" />
                <label className="mysql-table-design-check"><input type="checkbox" checked={col.nullable} onChange={(e) => setColumns((prev) => prev.map((x) => x.id === col.id ? { ...x, nullable: e.target.checked } : x))} />可空</label>
                <label className="mysql-table-design-check"><input type="checkbox" checked={col.markedDrop} onChange={(e) => setColumns((prev) => prev.map((x) => x.id === col.id ? { ...x, markedDrop: e.target.checked } : x))} />删除</label>
              </div>
            ))}
          </div>
          <button className="btn btn-ghost" onClick={() => setColumns((prev) => [...prev, { id: nextId(), name: "", type: "", nullable: true, defaultValue: "", extra: "", comment: "", isNew: true, markedDrop: false }])}>
            新增字段
          </button>
        </div>
      ) : (
        <div className="mysql-table-design-section">
          <div className="mysql-table-design-section-title">索引</div>
          <div className="mysql-table-design-grid indexes">
            {indexes.map((idx) => {
              const cols = parseIndexColumns(idx.columns);
              const selectableCols = availableIndexColumns.filter((name) => !cols.includes(name));
              return (
                <div key={idx.id} className={`mysql-table-design-index-card ${idx.markedDrop ? "is-drop" : ""}`}>
                  <div className="mysql-table-design-index-head">
                    <input className="mysql-field" value={idx.name} onChange={(e) => setIndexes((prev) => prev.map((x) => x.id === idx.id ? { ...x, name: e.target.value } : x))} placeholder="索引名" disabled={idx.name === "PRIMARY"} />
                    <select className="mysql-field mysql-select" value={idx.kind} onChange={(e) => setIndexes((prev) => prev.map((x) => x.id === idx.id ? { ...x, kind: e.target.value as IndexDraft["kind"] } : x))} disabled={idx.name === "PRIMARY"}>
                      <option value="INDEX">普通</option>
                      <option value="UNIQUE">唯一</option>
                      <option value="PRIMARY">主键</option>
                    </select>
                    <label className="mysql-table-design-check"><input type="checkbox" checked={idx.markedDrop} disabled={idx.name === "PRIMARY"} onChange={(e) => setIndexes((prev) => prev.map((x) => x.id === idx.id ? { ...x, markedDrop: e.target.checked } : x))} />删除</label>
                  </div>
                  <div className="mysql-index-columns-editor">
                    <div className="mysql-index-columns-list">
                      {cols.length === 0 ? <span className="mysql-table-empty">暂未选择字段</span> : null}
                      {cols.map((colName, index) => (
                        <span key={`${colName}-${index}`} className="mysql-index-col-chip">
                          <span>{colName}</span>
                          <button
                            type="button"
                            className="btn btn-ghost mysql-index-chip-btn"
                            disabled={index <= 0}
                            onClick={() => {
                              const next = [...cols];
                              [next[index - 1], next[index]] = [next[index], next[index - 1]];
                              updateIndexColumns(idx.id, next);
                            }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost mysql-index-chip-btn"
                            disabled={index >= cols.length - 1}
                            onClick={() => {
                              const next = [...cols];
                              [next[index + 1], next[index]] = [next[index], next[index + 1]];
                              updateIndexColumns(idx.id, next);
                            }}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost mysql-index-chip-btn"
                            onClick={() => updateIndexColumns(idx.id, cols.filter((_, i) => i !== index))}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <select
                      className="mysql-field mysql-select"
                      value=""
                      onChange={(e) => {
                        const picked = e.target.value;
                        if (!picked) return;
                        updateIndexColumns(idx.id, [...cols, picked]);
                      }}
                    >
                      <option value="">添加字段到索引（按选择顺序生成）</option>
                      {selectableCols.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="btn btn-ghost" onClick={() => setIndexes((prev) => [...prev, { id: nextId(), name: "", kind: "INDEX", columns: "", method: "BTREE", isNew: true, markedDrop: false }])}>
            新增索引
          </button>
        </div>
      )}
    </div>
  );
}
