import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  connectMySql,
  mySqlExecuteQuery,
  mySqlListColumns,
  mySqlListDatabases,
  mySqlListTables,
} from "../../services/bridge";
import type { I18nKey } from "../../i18n";
import type { MySqlConnection, MySqlColumnInfo, MySqlTableInfo } from "../../services/types";
import { escapeSqlIdentifier, escapeSqlValue } from "./sqlUtils";
import { createEmptyCondition, type MySqlFilterCondition, type MySqlQueryEditorState, type MySqlTableDataState } from "./types";

interface Params {
  selected: MySqlConnection | undefined;
  connections: MySqlConnection[];
  activeSchema: string;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  setActiveSchema: (value: string) => void;
  setActiveTable: (value: string) => void;
  setLocalError: (value: string | null) => void;
  setColumns: (value: MySqlColumnInfo[]) => void;
  tableDataMap: Record<string, MySqlTableDataState>;
  setTableDataMap: Dispatch<SetStateAction<Record<string, MySqlTableDataState>>>;
  queryEditorMap: Record<string, MySqlQueryEditorState>;
  setQueryEditorMap: Dispatch<SetStateAction<Record<string, MySqlQueryEditorState>>>;
}

export function useMySqlDataLoader({
  selected,
  connections,
  activeSchema,
  tr,
  setActiveSchema,
  setActiveTable,
  setLocalError,
  setColumns,
  tableDataMap,
  setTableDataMap,
  queryEditorMap,
  setQueryEditorMap,
}: Params) {
  const PAGE_SIZE = 100;
  const [databases, setDatabases] = useState<string[]>([]);
  const [tables, setTables] = useState<MySqlTableInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [schemaTablesCache, setSchemaTablesCache] = useState<Record<string, string[]>>({});
  const [tableColumnsCache, setTableColumnsCache] = useState<Record<string, string[]>>({});

  const ensureConnected = useCallback(async () => {
    if (!selected) throw new Error(tr("mysql.error.noConnectionSelected"));
    await connectMySql(selected.id);
  }, [selected, tr]);

  const loadTablesForSchema = useCallback(async (schema: string) => {
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
  }, [selected, setActiveTable, setColumns, setLocalError]);

  const loadTableData = useCallback(async (
    tabId: string,
    schema: string,
    table: string,
    queryConditions?: MySqlFilterCondition[],
    page = 0,
    pageSize?: number
  ) => {
    if (!selected) return;
    try {
      await ensureConnected();
      const conditions = queryConditions ?? tableDataMap[tabId]?.conditions ?? [];
      const enabledConditions = conditions.filter((item) => item.column.trim() && item.value.trim() !== "");
      const whereClause = enabledConditions
        .map((item) => {
          const columnSql = `\`${escapeSqlIdentifier(item.column.trim())}\``;
          const valueSql = escapeSqlValue(item.value.trim());
          switch (item.operator) {
            case "eq":
              return `${columnSql} = '${valueSql}'`;
            case "ne":
              return `${columnSql} != '${valueSql}'`;
            case "gt":
              return `${columnSql} > '${valueSql}'`;
            case "ge":
              return `${columnSql} >= '${valueSql}'`;
            case "lt":
              return `${columnSql} < '${valueSql}'`;
            case "le":
              return `${columnSql} <= '${valueSql}'`;
            case "contains":
            default:
              return `${columnSql} LIKE '%${valueSql}%'`;
          }
        })
        .join(" AND ");
      const resolvedPageSize = pageSize ?? tableDataMap[tabId]?.pageSize ?? PAGE_SIZE;
      const countQuery =
        `SELECT CAST(COUNT(*) AS CHAR) FROM \`${escapeSqlIdentifier(schema)}\`.\`${escapeSqlIdentifier(table)}\`` +
        (whereClause ? ` WHERE ${whereClause}` : "");
      const countResult = await mySqlExecuteQuery(selected.id, countQuery, 1, 0);
      const totalRows = Number(countResult.rows?.[0]?.[0] ?? 0) || 0;

      const query =
        `SELECT * FROM \`${escapeSqlIdentifier(schema)}\`.\`${escapeSqlIdentifier(table)}\`` +
        (whereClause ? ` WHERE ${whereClause}` : "") +
        ` LIMIT ${resolvedPageSize} OFFSET ${page * resolvedPageSize}`;
      const data = await mySqlExecuteQuery(selected.id, query, resolvedPageSize, page * resolvedPageSize);
      setTableDataMap((prev) => ({
        ...prev,
        [tabId]: {
          ...(prev[tabId] ?? {
            loading: false,
            conditions: [createEmptyCondition()],
            columns: [],
            rows: [],
            page: 0,
            pageSize: resolvedPageSize,
            totalRows: 0,
          }),
          loading: false,
          conditions: prev[tabId]?.conditions ?? queryConditions ?? [createEmptyCondition()],
          columns: data.columns,
          rows: data.rows,
          page,
          pageSize: resolvedPageSize,
          totalRows,
          error: undefined,
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTableDataMap((prev) => ({
        ...prev,
        [tabId]: {
          ...(prev[tabId] ?? {
            loading: false,
            conditions: [createEmptyCondition()],
            columns: [],
            rows: [],
            page: 0,
            pageSize: resolvedPageSize,
            totalRows: 0,
          }),
          loading: false,
          conditions: prev[tabId]?.conditions ?? queryConditions ?? [createEmptyCondition()],
          columns: [],
          rows: [],
          page,
          pageSize: resolvedPageSize,
          error: message,
        },
      }));
    }
  }, [ensureConnected, selected, setTableDataMap, tableDataMap]);

  const runQueryEditor = useCallback(async (tabId: string, schema?: string) => {
    if (!selected) return;
    const state = queryEditorMap[tabId];
    const sql = state?.sql?.trim();
    if (!sql) return;
    setQueryEditorMap((prev) => ({
      ...prev,
      [tabId]: {
        ...(prev[tabId] ?? { sql: "", cursor: 0, running: false, explaining: false, result: null, explainResult: null }),
        running: true,
        error: undefined,
      },
    }));
    try {
      await ensureConnected();
      const result = await mySqlExecuteQuery(selected.id, sql, 200, 0, schema);
      setQueryEditorMap((prev) => ({ ...prev, [tabId]: { ...(prev[tabId] ?? state), running: false, result, error: undefined } }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setQueryEditorMap((prev) => ({ ...prev, [tabId]: { ...(prev[tabId] ?? state), running: false, error: message } }));
    }
  }, [ensureConnected, queryEditorMap, selected, setQueryEditorMap]);

  const explainQueryEditor = useCallback(async (tabId: string, schema?: string) => {
    if (!selected) return;
    const state = queryEditorMap[tabId];
    const sql = state?.sql?.trim();
    if (!sql) return;
    setQueryEditorMap((prev) => ({
      ...prev,
      [tabId]: {
        ...(prev[tabId] ?? { sql: "", cursor: 0, running: false, explaining: false, result: null, explainResult: null }),
        explaining: true,
        error: undefined,
      },
    }));
    try {
      await ensureConnected();
      const explainResult = await mySqlExecuteQuery(selected.id, `EXPLAIN ${sql}`, 200, 0, schema);
      setQueryEditorMap((prev) => ({ ...prev, [tabId]: { ...(prev[tabId] ?? state), explaining: false, explainResult, error: undefined } }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setQueryEditorMap((prev) => ({ ...prev, [tabId]: { ...(prev[tabId] ?? state), explaining: false, error: message } }));
    }
  }, [ensureConnected, queryEditorMap, selected, setQueryEditorMap]);

  const ensureSchemaTables = useCallback(async (schema: string) => {
    if (!selected) return [] as string[];
    let nextTables = schemaTablesCache[schema] ?? [];
    if (nextTables.length === 0) {
      const rows = await mySqlListTables(selected.id, schema);
      nextTables = rows.map((item) => item.name);
      setSchemaTablesCache((prev) => ({ ...prev, [schema]: nextTables }));
    }
    return nextTables;
  }, [schemaTablesCache, selected]);

  const ensureTableColumns = useCallback(async (schema: string, table: string) => {
    if (!selected) return [] as string[];
    const key = `${schema}.${table}`;
    let cols = tableColumnsCache[key] ?? [];
    if (cols.length === 0) {
      try {
        const rows = await mySqlListColumns(selected.id, schema, table);
        cols = rows.map((item) => item.name);
        setTableColumnsCache((prev) => ({ ...prev, [key]: cols }));
      } catch {
        cols = [];
      }
    }
    return cols;
  }, [selected, tableColumnsCache]);

  const loadSchema = useCallback(async (connectionId?: string) => {
    const targetId = connectionId ?? selected?.id;
    if (!targetId) return;
    const targetConnection = connections.find((item) => item.id === targetId);
    setBusy(true);
    setLocalError(null);
    try {
      await connectMySql(targetId);
      const dbs = await mySqlListDatabases(targetId);
      setDatabases(dbs);
      const schema = activeSchema || targetConnection?.database || dbs[0] || "";
      setActiveSchema(schema);
      if (!schema) return;
      setTablesLoading(true);
      const rows = await mySqlListTables(targetId, schema);
      setTables(rows);
      if (rows[0]) {
        setActiveTable(rows[0].name);
        setColumns(await mySqlListColumns(targetId, schema, rows[0].name));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLocalError(message);
    } finally {
      setTablesLoading(false);
      setBusy(false);
    }
  }, [activeSchema, connections, selected?.id, setActiveSchema, setActiveTable, setColumns, setLocalError]);

  return {
    databases,
    tables,
    busy,
    tablesLoading,
    loadTablesForSchema,
    loadTableData,
    runQueryEditor,
    explainQueryEditor,
    ensureSchemaTables,
    ensureTableColumns,
    loadSchema,
  };
}
