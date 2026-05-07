import { useCallback, useEffect, useMemo, useState } from "react";
import { mySqlExecuteQuery } from "../../services/bridge";
import { useI18n } from "../../i18n-context";
import { escapeSqlIdentifier, escapeSqlValue } from "./sqlUtils";
import { type ColumnDraft, type IndexDraft } from "./types";
import { MySqlColumnEditor } from "./MySqlColumnEditor";
import { MySqlIndexEditor } from "./MySqlIndexEditor";

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

export function MySqlTableDesignEditor({ connectionId, schema, table }: Props) {
  const { tr } = useI18n();
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
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
        setMessage(tr("mysql.page.noChanges"));
        return;
      }

      for (const sql of sqlList) {
        await mySqlExecuteQuery(connectionId, sql, 1, 0, schema);
      }
      setMessage(tr("mysql.page.saveSuccessSqlCount", { count: sqlList.length }));
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
        <div className="mysql-table-design-title">{tr("mysql.page.editTabTitle", { schema, table })}</div>
        <button className="btn btn-ghost" onClick={() => void loadMeta()} disabled={loading || saving}>
          {loading ? tr("sftp.loading") : tr("mysql.page.refreshStructure")}
        </button>
        <button className="btn" onClick={() => void saveAll()} disabled={!canSave}>
          {saving ? tr("mysql.page.savingChanges") : tr("mysql.page.saveChanges")}
        </button>
      </div>
      <div className="mysql-table-design-tabbar">
        <button
          className={`btn btn-ghost ${activeTab === "columns" ? "is-active" : ""}`}
          onClick={() => setActiveTab("columns")}
        >
          {tr("mysql.page.tabColumns")}
        </button>
        <button
          className={`btn btn-ghost ${activeTab === "indexes" ? "is-active" : ""}`}
          onClick={() => setActiveTab("indexes")}
        >
          {tr("mysql.page.tabIndexes")}
        </button>
      </div>
      {error ? <div className="mysql-table-empty">{error}</div> : null}
      {message ? <div className="mysql-data-summary">{message}</div> : null}

      {activeTab === "columns" ? (
        <MySqlColumnEditor
          tr={tr}
          tableComment={tableComment}
          setTableComment={setTableComment}
          columns={columns}
          setColumns={setColumns}
          columnTypeOptions={columnTypeOptions}
        />
      ) : (
        <MySqlIndexEditor
          tr={tr}
          indexes={indexes}
          setIndexes={setIndexes}
          availableIndexColumns={availableIndexColumns}
        />
      )}
    </div>
  );
}
