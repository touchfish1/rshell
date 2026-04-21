/**
 * 前端与 Tauri 后端的薄封装：`invoke` 各命令、`listen` 审计事件，类型与 `types.ts` 对齐。
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AuditRecord,
  HostMetrics,
  HostReachability,
  Protocol,
  Session,
  SessionInput,
  SftpEntry,
  SftpTextReadResult,
  ZkNodeData,
  ZookeeperConnection,
  ZookeeperConnectionInput,
  RedisConnection,
  RedisConnectionInput,
  RedisDatabaseInfo,
  RedisKeyData,
  RedisKeyRef,
  RedisScanResult,
  RedisValueData,
  RedisValueUpdate,
  MySqlColumnInfo,
  MySqlConnection,
  MySqlConnectionInput,
  MySqlQueryResult,
  MySqlTableInfo,
} from "./types";

export async function listSessions(): Promise<Session[]> {
  return invoke("list_sessions");
}

export async function createSession(input: SessionInput, secret?: string): Promise<Session> {
  return invoke("create_session", { input, secret });
}

export async function updateSession(id: string, input: SessionInput, secret?: string): Promise<Session> {
  return invoke("update_session", { id, input, secret });
}

export async function deleteSession(id: string): Promise<void> {
  await invoke("delete_session", { id });
}

export async function hasSessionSecret(id: string): Promise<boolean> {
  return invoke("has_session_secret", { id });
}

export async function getSessionSecret(id: string): Promise<string | null> {
  return invoke("get_session_secret", { id });
}

export async function connectSession(id: string, secret?: string): Promise<void> {
  await invoke("connect_session", { id, secret });
}

export async function pullOutput(id: string): Promise<string | null> {
  return invoke("pull_output", { id });
}

export async function disconnectSession(id: string): Promise<void> {
  await invoke("disconnect_session", { id });
}

export async function sendInput(id: string, input: string): Promise<void> {
  await invoke("send_input", { id, input });
}

export async function resizeTerminal(id: string, cols: number, rows: number): Promise<void> {
  await invoke("resize_terminal", { id, cols, rows });
}

export async function listSftpDir(id: string, path?: string): Promise<SftpEntry[]> {
  return invoke("list_sftp_dir", { id, path });
}

export async function downloadSftpFile(id: string, remotePath: string): Promise<string> {
  return invoke("download_sftp_file", { id, remotePath });
}

export async function readSftpTextFile(id: string, remotePath: string): Promise<SftpTextReadResult> {
  return invoke("read_sftp_text_file", { id, remotePath });
}

export async function saveSftpTextFile(id: string, remotePath: string, content: string): Promise<void> {
  await invoke("save_sftp_text_file", { id, remotePath, content });
}

export async function uploadSftpFile(
  id: string,
  remoteDir: string,
  fileName: string,
  contentBase64: string
): Promise<void> {
  await invoke("upload_sftp_file", { id, remoteDir, fileName, contentBase64 });
}

export async function openInFileManager(path: string): Promise<void> {
  await invoke("open_in_file_manager", { path });
}

export async function openExternalUrl(url: string): Promise<void> {
  await invoke("open_external_url", { url });
}

export async function testHostReachability(
  host: string,
  port: number,
  timeoutMs = 2000,
  protocol?: Protocol
): Promise<HostReachability> {
  const raw = await invoke<{ online: boolean; latency_ms: number | null }>("test_host_reachability", {
    host,
    port,
    timeout_ms: timeoutMs,
    protocol: protocol ?? null,
  });
  return {
    online: raw.online === true,
    latency_ms: raw.latency_ms ?? null,
  };
}

export async function getHostMetrics(id: string): Promise<HostMetrics> {
  return invoke("get_host_metrics", { id });
}

export async function listAudits(limit = 300): Promise<AuditRecord[]> {
  return invoke("list_audits", { limit });
}

export function onTerminalOutput(handler: (payload: { sessionId: string; data: string }) => void) {
  return listen<{ sessionId: string; data: string }>("terminal-output", (event) => {
    handler(event.payload);
  });
}

export function onDebugLog(
  handler: (payload: { sessionId: string; stage: string; message: string }) => void
) {
  return listen<{ sessionId: string; stage: string; message: string }>("debug-log", (event) => {
    handler(event.payload);
  });
}

export async function listZookeeperConnections(): Promise<ZookeeperConnection[]> {
  return invoke("list_zookeeper_connections");
}

export async function createZookeeperConnection(
  input: ZookeeperConnectionInput,
  secret?: string
): Promise<ZookeeperConnection> {
  return invoke("create_zookeeper_connection", { input, secret });
}

export async function updateZookeeperConnection(
  id: string,
  input: ZookeeperConnectionInput,
  secret?: string
): Promise<ZookeeperConnection> {
  return invoke("update_zookeeper_connection", { id, input, secret });
}

export async function deleteZookeeperConnection(id: string): Promise<void> {
  await invoke("delete_zookeeper_connection", { id });
}

export async function hasZookeeperSecret(id: string): Promise<boolean> {
  return invoke("has_zookeeper_secret", { id });
}

export async function getZookeeperSecret(id: string): Promise<string | null> {
  return invoke("get_zookeeper_secret", { id });
}

export async function connectZookeeper(id: string, secret?: string): Promise<void> {
  await invoke("connect_zookeeper", { id, secret });
}

export async function testZookeeperConnection(
  connectString: string,
  sessionTimeoutMs?: number,
  secret?: string
): Promise<void> {
  await invoke("test_zookeeper_connection", {
    // Tauri command args are camelCase-mapped from Rust snake_case params.
    connectString,
    sessionTimeoutMs: sessionTimeoutMs ?? null,
    secret: secret ?? null,
  });
}

export async function disconnectZookeeper(id: string): Promise<void> {
  await invoke("disconnect_zookeeper", { id });
}

export async function zkListChildren(id: string, path: string): Promise<string[]> {
  return invoke("zk_list_children", { id, path });
}

export async function zkGetData(id: string, path: string): Promise<ZkNodeData> {
  return invoke("zk_get_data", { id, path });
}

export async function zkSetData(id: string, path: string, dataUtf8: string): Promise<void> {
  await invoke("zk_set_data", { id, path, dataUtf8 });
}

export async function listRedisConnections(): Promise<RedisConnection[]> {
  return invoke("list_redis_connections");
}

export async function createRedisConnection(
  input: RedisConnectionInput,
  secret?: string
): Promise<RedisConnection> {
  return invoke("create_redis_connection", { input, secret });
}

export async function updateRedisConnection(
  id: string,
  input: RedisConnectionInput,
  secret?: string
): Promise<RedisConnection> {
  return invoke("update_redis_connection", { id, input, secret });
}

export async function deleteRedisConnection(id: string): Promise<void> {
  await invoke("delete_redis_connection", { id });
}

export async function getRedisSecret(id: string): Promise<string | null> {
  return invoke("get_redis_secret", { id });
}

export async function connectRedis(id: string, secret?: string): Promise<void> {
  await invoke("connect_redis", { id, secret });
}

export async function testRedisConnection(address: string, db?: number, secret?: string): Promise<void> {
  await invoke("test_redis_connection", {
    address,
    db: db ?? null,
    secret: secret ?? null,
  });
}

export async function disconnectRedis(id: string): Promise<void> {
  await invoke("disconnect_redis", { id });
}

export async function redisListKeys(id: string, pattern?: string): Promise<string[]> {
  return invoke("redis_list_keys", { id, pattern: pattern ?? null });
}

export async function redisGetValue(id: string, keyBase64: string): Promise<RedisValueData> {
  return invoke("redis_get_value", { id, keyBase64 });
}

export async function redisSetValue(id: string, keyBase64: string, value: string): Promise<void> {
  await invoke("redis_set_value", { id, keyBase64, value });
}

export async function redisScanKeys(
  id: string,
  cursor = 0,
  pattern?: string,
  count = 50
): Promise<RedisScanResult> {
  return invoke("redis_scan_keys", {
    id,
    cursor,
    pattern: pattern ?? null,
    count,
  });
}

export async function redisListDatabases(id: string): Promise<RedisDatabaseInfo[]> {
  return invoke("redis_list_databases", { id });
}

export async function redisGetKeyData(id: string, keyBase64: string): Promise<RedisKeyData> {
  return invoke("redis_get_key_data", { id, keyBase64 });
}

export async function redisSetKeyData(id: string, keyBase64: string, payload: RedisValueUpdate): Promise<void> {
  await invoke("redis_set_key_data", { id, keyBase64, payload });
}

export async function redisSetTtl(id: string, keyBase64: string, ttlSeconds?: number): Promise<void> {
  await invoke("redis_set_ttl", { id, keyBase64, ttlSeconds: ttlSeconds ?? null });
}

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
  offset = 0
): Promise<MySqlQueryResult> {
  return invoke("mysql_execute_query", { id, sql, limit, offset });
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
