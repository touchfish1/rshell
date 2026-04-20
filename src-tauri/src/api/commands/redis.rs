//! Redis：连接 CRUD、密钥、连接管理与 key/value 浏览。

use tauri::State;
use uuid::Uuid;

use crate::app::AppState;
use crate::domain::redis::{RedisConnection, RedisConnectionInput};
use base64::Engine;

#[derive(Debug, Clone, serde::Serialize)]
pub struct RedisValueData {
    pub key_base64: String,
    pub value: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct RedisScanResult {
    pub next_cursor: u64,
    pub keys: Vec<RedisKeyRef>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct RedisDatabaseInfo {
    pub db: u32,
    pub key_count: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct RedisKeyRef {
    pub key_base64: String,
    pub key_utf8: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RedisHashEntry {
    pub field: String,
    pub value: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RedisZsetEntry {
    pub member: String,
    pub score: f64,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum RedisValuePayload {
    String { value: Option<String> },
    Hash { entries: Vec<RedisHashEntry> },
    List { items: Vec<String> },
    Set { members: Vec<String> },
    Zset { entries: Vec<RedisZsetEntry> },
    Unsupported { raw_type: String },
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct RedisKeyData {
    pub key_base64: String,
    pub key_utf8: Option<String>,
    pub key_type: String,
    pub ttl_seconds: i64,
    pub payload: RedisValuePayload,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum RedisValueUpdate {
    String { value: String },
    Hash { entries: Vec<RedisHashEntry> },
    List { items: Vec<String> },
    Set { members: Vec<String> },
    Zset { entries: Vec<RedisZsetEntry> },
}

fn encode_key_ref(key: &[u8]) -> RedisKeyRef {
    let key_utf8 = best_effort_utf8(key);
    let key_base64 = base64::engine::general_purpose::STANDARD.encode(key);
    RedisKeyRef { key_base64, key_utf8 }
}

fn best_effort_utf8(bytes: &[u8]) -> Option<String> {
    if let Ok(s) = String::from_utf8(bytes.to_vec()) {
        return Some(s);
    }
    Some(String::from_utf8_lossy(bytes).to_string())
}

fn display_bytes(bytes: &[u8]) -> String {
    best_effort_utf8(bytes).unwrap_or_default()
}

fn decode_display(value: &str) -> Result<Vec<u8>, String> {
    let s = value.trim();
    if let Some(rest) = s.strip_prefix("b64:") {
        return base64::engine::general_purpose::STANDARD
            .decode(rest.trim())
            .map_err(|e| format!("invalid base64: {e}"));
    }
    Ok(s.as_bytes().to_vec())
}

fn decode_key_base64(key_base64: &str) -> Result<Vec<u8>, String> {
    base64::engine::general_purpose::STANDARD
        .decode(key_base64.trim())
        .map_err(|e| format!("invalid key_base64: {e}"))
}

pub async fn list_redis_connections(state: State<'_, AppState>) -> Result<Vec<RedisConnection>, String> {
    Ok(state.list_redis_connections().await)
}

pub async fn create_redis_connection(
    state: State<'_, AppState>,
    input: RedisConnectionInput,
    secret: Option<String>,
) -> Result<RedisConnection, String> {
    state.create_redis_connection(input, secret).await
}

pub async fn update_redis_connection(
    state: State<'_, AppState>,
    id: String,
    input: RedisConnectionInput,
    secret: Option<String>,
) -> Result<RedisConnection, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.update_redis_connection(id, input, secret).await
}

pub async fn delete_redis_connection(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.delete_redis_connection(id).await
}

pub async fn get_redis_secret(state: State<'_, AppState>, id: String) -> Result<Option<String>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.get_redis_secret(id).await
}

pub async fn connect_redis(
    state: State<'_, AppState>,
    id: String,
    secret: Option<String>,
) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.connect_redis(id, secret).await
}

pub async fn test_redis_connection(
    address: String,
    db: Option<u32>,
    secret: Option<String>,
) -> Result<(), String> {
    let addr = address.trim();
    if addr.is_empty() {
        return Err("redis address is empty".to_string());
    }
    let (host, port_str) = addr
        .rsplit_once(':')
        .ok_or_else(|| "redis address must be host:port".to_string())?;
    let host = host.trim();
    let port: u16 = port_str
        .trim()
        .parse()
        .map_err(|_| "redis port must be an integer".to_string())?;
    let info = ::redis::ConnectionInfo {
        addr: ::redis::ConnectionAddr::Tcp(host.to_string(), port),
        redis: ::redis::RedisConnectionInfo {
            protocol: ::redis::ProtocolVersion::RESP2,
            db: db.unwrap_or(0) as i64,
            username: None,
            password: secret.filter(|s| !s.trim().is_empty()),
        },
    };
    let client = ::redis::Client::open(info).map_err(|e| e.to_string())?;
    let mut conn = client
        .get_multiplexed_tokio_connection()
        .await
        .map_err(|e| e.to_string())?;
    let _: ::redis::Value = ::redis::cmd("PING")
        .query_async(&mut conn)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn disconnect_redis(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.disconnect_redis(id).await
}

pub async fn redis_list_keys(
    state: State<'_, AppState>,
    id: String,
    pattern: Option<String>,
) -> Result<Vec<String>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.redis_list_keys(id, pattern).await
}

pub async fn redis_scan_keys(
    state: State<'_, AppState>,
    id: String,
    cursor: Option<u64>,
    pattern: Option<String>,
    count: Option<u64>,
) -> Result<RedisScanResult, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let (next_cursor, keys) = state
        .redis_scan_keys(id, cursor.unwrap_or(0), pattern, count)
        .await?;
    Ok(RedisScanResult {
        next_cursor,
        keys: keys.into_iter().map(|k| encode_key_ref(&k)).collect(),
    })
}

pub async fn redis_list_databases(
    state: State<'_, AppState>,
    id: String,
) -> Result<Vec<RedisDatabaseInfo>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let rows = state.redis_list_databases(id).await?;
    Ok(rows
        .into_iter()
        .map(|(db, key_count)| RedisDatabaseInfo { db, key_count })
        .collect())
}

pub async fn redis_get_key_data(
    state: State<'_, AppState>,
    id: String,
    key_base64: String,
) -> Result<RedisKeyData, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let key = decode_key_base64(&key_base64)?;
    let key_type = state.redis_get_key_type(id, key.clone()).await?;
    let ttl_seconds = state.redis_get_ttl(id, key.clone()).await?;
    let payload = match key_type.as_str() {
        "string" => RedisValuePayload::String {
            value: state.redis_get_string(id, key.clone()).await?,
        },
        "hash" => RedisValuePayload::Hash {
            entries: state
                .redis_get_hash(id, key.clone())
                .await?
                .into_iter()
                .map(|(field, value)| RedisHashEntry {
                    field: display_bytes(&field),
                    value: display_bytes(&value),
                })
                .collect(),
        },
        "list" => RedisValuePayload::List {
            items: state
                .redis_get_list(id, key.clone())
                .await?
                .into_iter()
                .map(|v| display_bytes(&v))
                .collect(),
        },
        "set" => RedisValuePayload::Set {
            members: state
                .redis_get_set(id, key.clone())
                .await?
                .into_iter()
                .map(|v| display_bytes(&v))
                .collect(),
        },
        "zset" => RedisValuePayload::Zset {
            entries: state
                .redis_get_zset(id, key.clone())
                .await?
                .into_iter()
                .map(|(member, score)| RedisZsetEntry {
                    member: display_bytes(&member),
                    score,
                })
                .collect(),
        },
        other => RedisValuePayload::Unsupported {
            raw_type: other.to_string(),
        },
    };
    Ok(RedisKeyData {
        key_base64,
        key_utf8: best_effort_utf8(&key),
        key_type,
        ttl_seconds,
        payload,
    })
}

pub async fn redis_set_key_data(
    state: State<'_, AppState>,
    id: String,
    key_base64: String,
    payload: RedisValueUpdate,
) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let key = decode_key_base64(&key_base64)?;
    match payload {
        RedisValueUpdate::String { value } => state.redis_set_string(id, key, decode_display(&value)?).await?,
        RedisValueUpdate::Hash { entries } => {
            state
                .redis_set_hash(
                    id,
                    key,
                    entries
                        .into_iter()
                        .map(|entry| Ok((decode_display(&entry.field)?, decode_display(&entry.value)?)))
                        .collect::<Result<Vec<_>, String>>()?,
                )
                .await?
        }
        RedisValueUpdate::List { items } => {
            state
                .redis_set_list(
                    id,
                    key,
                    items.into_iter().map(|v| decode_display(&v)).collect::<Result<Vec<_>, String>>()?,
                )
                .await?
        }
        RedisValueUpdate::Set { members } => {
            state
                .redis_set_set(
                    id,
                    key,
                    members
                        .into_iter()
                        .map(|v| decode_display(&v))
                        .collect::<Result<Vec<_>, String>>()?,
                )
                .await?
        }
        RedisValueUpdate::Zset { entries } => {
            state
                .redis_set_zset(
                    id,
                    key,
                    entries
                        .into_iter()
                        .map(|entry| Ok((decode_display(&entry.member)?, entry.score)))
                        .collect::<Result<Vec<_>, String>>()?,
                )
                .await?
        }
    }
    Ok(())
}

pub async fn redis_set_ttl(
    state: State<'_, AppState>,
    id: String,
    key_base64: String,
    ttl_seconds: Option<i64>,
) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let key = decode_key_base64(&key_base64)?;
    state.redis_set_ttl(id, key, ttl_seconds).await
}

pub async fn redis_get_value(
    state: State<'_, AppState>,
    id: String,
    key_base64: String,
) -> Result<RedisValueData, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let key = decode_key_base64(&key_base64)?;
    let value = state.redis_get_string(id, key).await?;
    Ok(RedisValueData { key_base64, value })
}

pub async fn redis_set_value(
    state: State<'_, AppState>,
    id: String,
    key_base64: String,
    value: String,
) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let key = decode_key_base64(&key_base64)?;
    let value = decode_display(&value)?;
    state.redis_set_string(id, key, value).await
}
