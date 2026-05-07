import { invoke } from "@tauri-apps/api/core";
import type {
  MySqlColumnInfo,
  MySqlConnection,
  MySqlConnectionInput,
  MySqlQueryResult,
  MySqlTableInfo,
} from "../types";

export async function listMySqlConnections(): Promise<MySqlConnection[]> {
  return invoke("list_mysql_connections");
}

export async function createMySqlConnection(input: MySqlConnectionInput, secret?: string): Promise<MySqlConnection> {
  return invoke("create_mysql_connection", { input, secret });
}

export async function updateMySqlConnection(
  id: string,
  input: MySqlConnectionInput,
  secret?: string
): Promise<MySqlConnection> {
  return invoke("update_mysql_connection", { id, input, secret });
}

export async function deleteMySqlConnection(id: string): Promise<void> {
  await invoke("delete_mysql_connection", { id });
}

export async function getMySqlSecret(id: string): Promise<string | null> {
  return invoke("get_mysql_secret", { id });
}

export async function connectMySql(id: string, secret?: string): Promise<void> {
  await invoke("connect_mysql", { id, secret });
}

export async function testMySqlConnection(
  host: string,
  port: number,
  username: string,
  database?: string,
  secret?: string
): Promise<void> {
  await invoke("test_mysql_connection", {
    host,
    port,
    username,
    database: database ?? null,
    secret: secret ?? null,
  });
}

export async function disconnectMySql(id: string): Promise<void> {
  await invoke("disconnect_mysql", { id });
}

export async function mySqlListDatabases(id: string): Promise<string[]> {
  return invoke("mysql_list_databases", { id });
}

export async function mySqlListTables(id: string, schema: string): Promise<MySqlTableInfo[]> {
  return invoke("mysql_list_tables", { id, schema });
}

export async function mySqlListColumns(id: string, schema: string, table: string): Promise<MySqlColumnInfo[]> {
  return invoke("mysql_list_columns", { id, schema, table });
}

export async function mySqlExecuteQuery(
  id: string,
  sql: string,
  limit = 200,
  offset = 0,
  schema?: string
): Promise<MySqlQueryResult> {
  return invoke("mysql_execute_query", { id, sql, limit, offset, schema: schema ?? null });
}

export async function mySqlExplainQuery(id: string, sql: string): Promise<MySqlQueryResult> {
  return invoke("mysql_explain_query", { id, sql });
}

export async function mySqlAlterTableAddColumn(
  id: string,
  schema: string,
  table: string,
  columnName: string,
  columnType: string
): Promise<void> {
  await invoke("mysql_alter_table_add_column", {
    id,
    schema,
    table,
    columnName,
    columnType,
  });
}
