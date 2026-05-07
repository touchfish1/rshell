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
import { createEmptyCondition, DEFAULT_QUERY_LIMIT, type MySqlFilterCondition, type MySqlQueryEditorState, type MySqlTableDataState } from "./types";

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
  const [currentCommand, setCurrentCommand] = useState<string | null>(null);

  const ensureConnected = useCallback(async () => {
    if (!selected) throw new Error(tr("mysql.error.noConnectionSelected"));
    await connectMySql(selected.id);
  }, [selected, tr]);

  const loadTablesForSchema = useCallback(async (schema: string) => {
    if (!selected) return;
    setTablesLoading(true);
    setCurrentCommand(`SHOW TABLES FROM \`${escapeSqlIdentifier(schema)}\``);
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
      setCurrentCommand(null);
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
    const resolvedPageSize = pageSize ?? tableDataMap[tabId]?.pageSize ?? PAGE_SIZE;
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
      const countQuery =
        `SELECT CAST(COUNT(*) AS CHAR) FROM \`${escapeSqlIdentifier(schema)}\`.\`${escapeSqlIdentifier(table)}\`` +
        (whereClause ? ` WHERE ${whereClause}` : "");
      const countResult = await mySqlExecuteQuery(selected.id, countQuery, 1, 0);
      const totalRows = Number(countResult.rows?.[0]?.[0] ?? 0) || 0;

      const query =
        `SELECT * FROM \`${escapeSqlIdentifier(schema)}\`.\`${escapeSqlIdentifier(table)}\`` +
        (whereClause ? ` WHERE ${whereClause}` : "") +
        ` LIMIT ${resolvedPageSize} OFFSET ${page * resolvedPageSize}`;
      setCurrentCommand(query);
      const data = await mySqlExecuteQuery(selected.id, query, resolvedPageSize, page * resolvedPageSize);
      let columns = data.columns;
      let columnInfos: MySqlColumnInfo[] = [];
      if (table) {
        try {
          columnInfos = await mySqlListColumns(selected.id, schema, table);
          if (columns.length === 0) {
            columns = columnInfos.map((c) => c.name);
          }
        } catch {
          /* column info is optional */
        }
      }
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
          columns,
          rows: data.rows,
          page,
          pageSize: resolvedPageSize,
          totalRows,
          lastSql: query,
          error: undefined,
          columnInfos,
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
    } finally {
      setCurrentCommand(null);
    }
  }, [ensureConnected, selected, setTableDataMap, tableDataMap]);

  const runQueryEditor = useCallback(async (tabId: string, schema?: string, offset?: number) => {
    if (!selected) return;
    const state = queryEditorMap[tabId];
    const sql = state?.sql?.trim();
    if (!sql) return;
    const resolvedOffset = offset ?? 0;
    const resolvedLimit = state?.queryLimit ?? DEFAULT_QUERY_LIMIT;
    setQueryEditorMap((prev) => ({
      ...prev,
      [tabId]: {
        ...(prev[tabId] ?? { sql: "", cursor: 0, running: false, explaining: false, result: null, explainResult: null, queryOffset: 0, queryLimit: DEFAULT_QUERY_LIMIT }),
        running: true,
        error: undefined,
        queryOffset: resolvedOffset,
      },
    }));
    try {
      await ensureConnected();
      setCurrentCommand(sql);
      const result = await mySqlExecuteQuery(selected.id, sql, resolvedLimit, resolvedOffset, schema);
      setQueryEditorMap((prev) => ({ ...prev, [tabId]: { ...(prev[tabId] ?? state), running: false, result, error: undefined } }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setQueryEditorMap((prev) => ({ ...prev, [tabId]: { ...(prev[tabId] ?? state), running: false, error: message } }));
    } finally {
      setCurrentCommand(null);
    }
  }, [ensureConnected, queryEditorMap, selected, setQueryEditorMap]);

  const changeQueryOffset = useCallback(async (tabId: string, schema: string, newOffset: number) => {
    await runQueryEditor(tabId, schema, newOffset);
  }, [runQueryEditor]);

  const explainQueryEditor = useCallback(async (tabId: string, schema?: string) => {
    if (!selected) return;
    const state = queryEditorMap[tabId];
    const sql = state?.sql?.trim();
    if (!sql) return;
    setQueryEditorMap((prev) => ({
      ...prev,
      [tabId]: {
        ...(prev[tabId] ?? { sql: "", cursor: 0, running: false, explaining: false, result: null, explainResult: null, queryOffset: 0, queryLimit: DEFAULT_QUERY_LIMIT }),
        explaining: true,
        error: undefined,
      },
    }));
    try {
      await ensureConnected();
      setCurrentCommand(`EXPLAIN ${sql}`);
      const explainResult = await mySqlExecuteQuery(selected.id, `EXPLAIN ${sql}`, 200, 0, schema);
      setQueryEditorMap((prev) => ({ ...prev, [tabId]: { ...(prev[tabId] ?? state), explaining: false, explainResult, error: undefined } }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setQueryEditorMap((prev) => ({ ...prev, [tabId]: { ...(prev[tabId] ?? state), explaining: false, error: message } }));
    } finally {
      setCurrentCommand(null);
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
    setCurrentCommand("SHOW DATABASES / SHOW TABLES");
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
      setCurrentCommand(null);
    }
  }, [activeSchema, connections, selected?.id, setActiveSchema, setActiveTable, setColumns, setLocalError]);

  return {
    databases,
    tables,
    busy,
    tablesLoading,
    currentCommand,
    loadTablesForSchema,
    loadTableData,
    runQueryEditor,
    changeQueryOffset,
    explainQueryEditor,
    ensureSchemaTables,
    ensureTableColumns,
    loadSchema,
  };
}
