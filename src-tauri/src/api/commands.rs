//! Tauri 命令入口聚合：每个 `#[tauri::command]` 在此声明，实现分散在子模块。
//!
//! - `sessions`：会话 CRUD、密钥读写
//! - `terminal`：连接、终端 I/O、断开
//! - `sftp`：目录列表、下载、文本读写
//! - `metrics` / `system`：主机指标与系统打开目录、外链
//! - `test_host_reachability`：ICMP ping 与 TCP/协议横幅任一成功即为在线（禁 ping 时仍可通过端口探测），并返回探测耗时（毫秒，取成功路径中较短者）。

mod command_sanitize;
mod audit;
mod common;
mod metrics;
mod mysql;
mod reachability;
mod redis;
mod sessions;
mod sftp;
mod system;
mod terminal;
mod zookeeper;

use tauri::{AppHandle, State};

use crate::app::{AppState, AuditRecord, HostMetrics, MySqlColumnInfo, MySqlQueryResult, MySqlTableInfo, SftpEntry, SftpTextReadResult};
use crate::domain::mysql::{MySqlConnection, MySqlConnectionInput};
use crate::domain::session::{Session, SessionInput};
use crate::domain::redis::{RedisConnection, RedisConnectionInput};
use crate::domain::zookeeper::{ZookeeperConnection, ZookeeperConnectionInput};
pub use reachability::HostReachability;
pub use redis::{RedisDatabaseInfo, RedisKeyData, RedisScanResult, RedisValueData, RedisValueUpdate};
pub use zookeeper::ZkNodeData;

#[tauri::command]
pub async fn list_sessions(state: State<'_, AppState>) -> Result<Vec<Session>, String> {
    sessions::list_sessions(state).await
}

#[tauri::command]
pub async fn create_session(
    state: State<'_, AppState>,
    input: SessionInput,
    secret: Option<String>,
) -> Result<Session, String> {
    sessions::create_session(state, input, secret).await
}

#[tauri::command]
pub async fn update_session(
    state: State<'_, AppState>,
    id: String,
    input: SessionInput,
    secret: Option<String>,
) -> Result<Session, String> {
    sessions::update_session(state, id, input, secret).await
}

#[tauri::command]
pub async fn delete_session(state: State<'_, AppState>, id: String) -> Result<(), String> {
    sessions::delete_session(state, id).await
}

#[tauri::command]
pub async fn has_session_secret(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    sessions::has_session_secret(state, id).await
}

#[tauri::command]
pub async fn get_session_secret(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<String>, String> {
    sessions::get_session_secret(state, id).await
}

#[tauri::command]
pub async fn connect_session(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    secret: Option<String>,
) -> Result<(), String> {
    terminal::connect_session(app, state, id, secret).await
}

#[tauri::command]
pub async fn pull_output(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<String>, String> {
    terminal::pull_output(app, state, id).await
}

#[tauri::command]
pub async fn disconnect_session(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    terminal::disconnect_session(app, state, id).await
}

#[tauri::command]
pub async fn send_input(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    input: String,
) -> Result<(), String> {
    terminal::send_input(app, state, id, input).await
}

#[tauri::command]
pub async fn resize_terminal(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    terminal::resize_terminal(app, state, id, cols, rows).await
}

#[tauri::command]
pub async fn list_sftp_dir(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    path: Option<String>,
) -> Result<Vec<SftpEntry>, String> {
    sftp::list_sftp_dir(app, state, id, path).await
}

#[tauri::command]
pub async fn download_sftp_file(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    remote_path: String,
) -> Result<String, String> {
    sftp::download_sftp_file(app, state, id, remote_path).await
}

#[tauri::command]
pub async fn read_sftp_text_file(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    remote_path: String,
) -> Result<SftpTextReadResult, String> {
    sftp::read_sftp_text_file(app, state, id, remote_path).await
}

#[tauri::command]
pub async fn save_sftp_text_file(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    remote_path: String,
    content: String,
) -> Result<(), String> {
    sftp::save_sftp_text_file(app, state, id, remote_path, content).await
}

#[tauri::command]
pub async fn upload_sftp_file(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    remote_dir: String,
    file_name: String,
    content_base64: String,
) -> Result<(), String> {
    sftp::upload_sftp_file(app, state, id, remote_dir, file_name, content_base64).await
}

#[tauri::command]
pub async fn open_in_file_manager(path: String) -> Result<(), String> {
    system::open_in_file_manager(path).await
}

#[tauri::command]
pub async fn open_external_url(url: String) -> Result<(), String> {
    system::open_external_url(url).await
}

#[tauri::command]
pub async fn get_host_metrics(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<HostMetrics, String> {
    metrics::get_host_metrics(app, state, id).await
}

#[tauri::command]
pub async fn test_host_reachability(
    host: String,
    port: u16,
    timeout_ms: Option<u64>,
    protocol: Option<String>,
) -> Result<HostReachability, String> {
    reachability::test_host_reachability(host, port, timeout_ms, protocol).await
}

#[tauri::command]
pub async fn list_audits(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<AuditRecord>, String> {
    audit::list_audits(state, limit).await
}

#[tauri::command]
pub async fn list_zookeeper_connections(
    state: State<'_, AppState>,
) -> Result<Vec<ZookeeperConnection>, String> {
    zookeeper::list_zookeeper_connections(state).await
}

#[tauri::command]
pub async fn create_zookeeper_connection(
    state: State<'_, AppState>,
    input: ZookeeperConnectionInput,
    secret: Option<String>,
) -> Result<ZookeeperConnection, String> {
    zookeeper::create_zookeeper_connection(state, input, secret).await
}

#[tauri::command]
pub async fn update_zookeeper_connection(
    state: State<'_, AppState>,
    id: String,
    input: ZookeeperConnectionInput,
    secret: Option<String>,
) -> Result<ZookeeperConnection, String> {
    zookeeper::update_zookeeper_connection(state, id, input, secret).await
}

#[tauri::command]
pub async fn delete_zookeeper_connection(state: State<'_, AppState>, id: String) -> Result<(), String> {
    zookeeper::delete_zookeeper_connection(state, id).await
}

#[tauri::command]
pub async fn has_zookeeper_secret(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    zookeeper::has_zookeeper_secret(state, id).await
}

#[tauri::command]
pub async fn get_zookeeper_secret(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<String>, String> {
    zookeeper::get_zookeeper_secret(state, id).await
}

#[tauri::command]
pub async fn connect_zookeeper(
    state: State<'_, AppState>,
    id: String,
    secret: Option<String>,
) -> Result<(), String> {
    zookeeper::connect_zookeeper(state, id, secret).await
}

#[tauri::command]
pub async fn test_zookeeper_connection(
    connect_string: String,
    session_timeout_ms: Option<u64>,
    secret: Option<String>,
) -> Result<(), String> {
    zookeeper::test_zookeeper_connection(connect_string, session_timeout_ms, secret).await
}

#[tauri::command]
pub async fn disconnect_zookeeper(state: State<'_, AppState>, id: String) -> Result<(), String> {
    zookeeper::disconnect_zookeeper(state, id).await
}

#[tauri::command]
pub async fn zk_list_children(
    state: State<'_, AppState>,
    id: String,
    path: String,
) -> Result<Vec<String>, String> {
    zookeeper::zk_list_children(state, id, path).await
}

#[tauri::command]
pub async fn zk_get_data(
    state: State<'_, AppState>,
    id: String,
    path: String,
) -> Result<ZkNodeData, String> {
    zookeeper::zk_get_data(state, id, path).await
}

#[tauri::command]
pub async fn zk_set_data(
    state: State<'_, AppState>,
    id: String,
    path: String,
    data_utf8: String,
) -> Result<(), String> {
    zookeeper::zk_set_data(state, id, path, data_utf8).await
}

#[tauri::command]
pub async fn list_redis_connections(state: State<'_, AppState>) -> Result<Vec<RedisConnection>, String> {
    redis::list_redis_connections(state).await
}

#[tauri::command]
pub async fn create_redis_connection(
    state: State<'_, AppState>,
    input: RedisConnectionInput,
    secret: Option<String>,
) -> Result<RedisConnection, String> {
    redis::create_redis_connection(state, input, secret).await
}

#[tauri::command]
pub async fn update_redis_connection(
    state: State<'_, AppState>,
    id: String,
    input: RedisConnectionInput,
    secret: Option<String>,
) -> Result<RedisConnection, String> {
    redis::update_redis_connection(state, id, input, secret).await
}

#[tauri::command]
pub async fn delete_redis_connection(state: State<'_, AppState>, id: String) -> Result<(), String> {
    redis::delete_redis_connection(state, id).await
}

#[tauri::command]
pub async fn get_redis_secret(state: State<'_, AppState>, id: String) -> Result<Option<String>, String> {
    redis::get_redis_secret(state, id).await
}

#[tauri::command]
pub async fn connect_redis(
    state: State<'_, AppState>,
    id: String,
    secret: Option<String>,
) -> Result<(), String> {
    redis::connect_redis(state, id, secret).await
}

#[tauri::command]
pub async fn test_redis_connection(
    address: String,
    db: Option<u32>,
    secret: Option<String>,
) -> Result<(), String> {
    redis::test_redis_connection(address, db, secret).await
}

#[tauri::command]
pub async fn disconnect_redis(state: State<'_, AppState>, id: String) -> Result<(), String> {
    redis::disconnect_redis(state, id).await
}

#[tauri::command]
pub async fn redis_list_keys(
    state: State<'_, AppState>,
    id: String,
    pattern: Option<String>,
) -> Result<Vec<String>, String> {
    redis::redis_list_keys(state, id, pattern).await
}

#[tauri::command]
pub async fn redis_get_value(
    state: State<'_, AppState>,
    id: String,
    key_base64: String,
) -> Result<RedisValueData, String> {
    redis::redis_get_value(state, id, key_base64).await
}

#[tauri::command]
pub async fn redis_set_value(
    state: State<'_, AppState>,
    id: String,
    key_base64: String,
    value: String,
) -> Result<(), String> {
    redis::redis_set_value(state, id, key_base64, value).await
}

#[tauri::command]
pub async fn redis_scan_keys(
    state: State<'_, AppState>,
    id: String,
    cursor: Option<u64>,
    pattern: Option<String>,
    count: Option<u64>,
) -> Result<RedisScanResult, String> {
    redis::redis_scan_keys(state, id, cursor, pattern, count).await
}

#[tauri::command]
pub async fn redis_list_databases(
    state: State<'_, AppState>,
    id: String,
) -> Result<Vec<RedisDatabaseInfo>, String> {
    redis::redis_list_databases(state, id).await
}

#[tauri::command]
pub async fn redis_get_key_data(
    state: State<'_, AppState>,
    id: String,
    key_base64: String,
) -> Result<RedisKeyData, String> {
    redis::redis_get_key_data(state, id, key_base64).await
}

#[tauri::command]
pub async fn redis_set_key_data(
    state: State<'_, AppState>,
    id: String,
    key_base64: String,
    payload: RedisValueUpdate,
) -> Result<(), String> {
    redis::redis_set_key_data(state, id, key_base64, payload).await
}

#[tauri::command]
pub async fn redis_set_ttl(
    state: State<'_, AppState>,
    id: String,
    key_base64: String,
    ttl_seconds: Option<i64>,
) -> Result<(), String> {
    redis::redis_set_ttl(state, id, key_base64, ttl_seconds).await
}

#[tauri::command]
pub async fn list_mysql_connections(state: State<'_, AppState>) -> Result<Vec<MySqlConnection>, String> {
    mysql::list_mysql_connections(state).await
}

#[tauri::command]
pub async fn create_mysql_connection(
    state: State<'_, AppState>,
    input: MySqlConnectionInput,
    secret: Option<String>,
) -> Result<MySqlConnection, String> {
    mysql::create_mysql_connection(state, input, secret).await
}

#[tauri::command]
pub async fn update_mysql_connection(
    state: State<'_, AppState>,
    id: String,
    input: MySqlConnectionInput,
    secret: Option<String>,
) -> Result<MySqlConnection, String> {
    mysql::update_mysql_connection(state, id, input, secret).await
}

#[tauri::command]
pub async fn delete_mysql_connection(state: State<'_, AppState>, id: String) -> Result<(), String> {
    mysql::delete_mysql_connection(state, id).await
}

#[tauri::command]
pub async fn get_mysql_secret(state: State<'_, AppState>, id: String) -> Result<Option<String>, String> {
    mysql::get_mysql_secret(state, id).await
}

#[tauri::command]
pub async fn connect_mysql(
    state: State<'_, AppState>,
    id: String,
    secret: Option<String>,
) -> Result<(), String> {
    mysql::connect_mysql(state, id, secret).await
}

#[tauri::command]
pub async fn test_mysql_connection(
    host: String,
    port: Option<u16>,
    username: String,
    database: Option<String>,
    secret: Option<String>,
) -> Result<(), String> {
    mysql::test_mysql_connection(host, port, username, database, secret).await
}

#[tauri::command]
pub async fn disconnect_mysql(state: State<'_, AppState>, id: String) -> Result<(), String> {
    mysql::disconnect_mysql(state, id).await
}

#[tauri::command]
pub async fn mysql_list_databases(state: State<'_, AppState>, id: String) -> Result<Vec<String>, String> {
    mysql::mysql_list_databases(state, id).await
}

#[tauri::command]
pub async fn mysql_list_tables(
    state: State<'_, AppState>,
    id: String,
    schema: String,
) -> Result<Vec<MySqlTableInfo>, String> {
    mysql::mysql_list_tables(state, id, schema).await
}

#[tauri::command]
pub async fn mysql_list_columns(
    state: State<'_, AppState>,
    id: String,
    schema: String,
    table: String,
) -> Result<Vec<MySqlColumnInfo>, String> {
    mysql::mysql_list_columns(state, id, schema, table).await
}

#[tauri::command]
pub async fn mysql_execute_query(
    state: State<'_, AppState>,
    id: String,
    sql: String,
    limit: Option<u64>,
    offset: Option<u64>,
) -> Result<MySqlQueryResult, String> {
    mysql::mysql_execute_query(state, id, sql, limit, offset).await
}

#[tauri::command]
pub async fn mysql_explain_query(
    state: State<'_, AppState>,
    id: String,
    sql: String,
) -> Result<MySqlQueryResult, String> {
    mysql::mysql_explain_query(state, id, sql).await
}

#[tauri::command]
pub async fn mysql_alter_table_add_column(
    state: State<'_, AppState>,
    id: String,
    schema: String,
    table: String,
    column_name: String,
    column_type: String,
) -> Result<(), String> {
    mysql::mysql_alter_table_add_column(state, id, schema, table, column_name, column_type).await
}
