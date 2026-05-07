import { invoke } from "@tauri-apps/api/core";
import type {
  PostgreSqlColumnInfo,
  PostgreSqlConnection,
  PostgreSqlConnectionInput,
  PostgreSqlQueryResult,
  PostgreSqlTableInfo,
} from "../types";

export async function listPostgreSqlConnections(): Promise<PostgreSqlConnection[]> {
  return invoke("list_postgresql_connections");
}

export async function createPostgreSqlConnection(
  input: PostgreSqlConnectionInput,
  secret?: string
): Promise<PostgreSqlConnection> {
  return invoke("create_postgresql_connection", { input, secret });
}

export async function updatePostgreSqlConnection(
  id: string,
  input: PostgreSqlConnectionInput,
  secret?: string
): Promise<PostgreSqlConnection> {
  return invoke("update_postgresql_connection", { id, input, secret });
}

export async function deletePostgreSqlConnection(id: string): Promise<void> {
  await invoke("delete_postgresql_connection", { id });
}

export async function getPostgreSqlSecret(id: string): Promise<string | null> {
  return invoke("get_postgresql_secret", { id });
}

export async function connectPostgreSql(id: string, secret?: string): Promise<void> {
  await invoke("connect_postgresql", { id, secret });
}

export async function testPostgreSqlConnection(
  host: string,
  port: number,
  username: string,
  database?: string,
  secret?: string
): Promise<void> {
  await invoke("test_postgresql_connection", {
    host,
    port,
    username,
    database: database ?? null,
    secret: secret ?? null,
  });
}

export async function disconnectPostgreSql(id: string): Promise<void> {
  await invoke("disconnect_postgresql", { id });
}

export async function postgreSqlListDatabases(id: string): Promise<string[]> {
  return invoke("postgresql_list_databases", { id });
}

export async function postgreSqlListTables(id: string, schema: string): Promise<PostgreSqlTableInfo[]> {
  return invoke("postgresql_list_tables", { id, schema });
}

export async function postgreSqlListColumns(
  id: string,
  schema: string,
  table: string
): Promise<PostgreSqlColumnInfo[]> {
  return invoke("postgresql_list_columns", { id, schema, table });
}

export async function postgreSqlExecuteQuery(
  id: string,
  sql: string,
  limit = 200,
  offset = 0,
  schema?: string
): Promise<PostgreSqlQueryResult> {
  return invoke("postgresql_execute_query", { id, sql, limit, offset, schema: schema ?? null });
}

export async function postgreSqlExplainQuery(id: string, sql: string): Promise<PostgreSqlQueryResult> {
  return invoke("postgresql_explain_query", { id, sql });
}
