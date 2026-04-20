use tauri::State;
use uuid::Uuid;

use crate::app::AppState;

use super::audit::audit_redis_event;
use super::codec::{best_effort_utf8, decode_display, decode_key_base64, display_bytes, encode_key_ref};
use super::types::{
    RedisDatabaseInfo, RedisHashEntry, RedisKeyData, RedisScanResult, RedisValueData, RedisValuePayload,
    RedisValueUpdate, RedisZsetEntry,
};

pub async fn redis_scan_keys(
    state: State<'_, AppState>,
    id: String,
    cursor: Option<u64>,
    pattern: Option<String>,
    count: Option<u64>,
) -> Result<RedisScanResult, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let scan_cursor = cursor.unwrap_or(0);
    let scan_pattern = pattern.clone().unwrap_or_else(|| "*".to_string());
    let scan_count = count.unwrap_or(50);
    let (next_cursor, keys) = state
        .redis_scan_keys(id, scan_cursor, pattern, count)
        .await?;
    audit_redis_event(
        &state,
        id,
        "redis_scan_keys",
        format!(
            "scan keys cursor={scan_cursor} next_cursor={next_cursor} count={} pattern={scan_pattern}",
            keys.len()
        ),
        Some(format!("SCAN {scan_cursor} MATCH {scan_pattern} COUNT {scan_count}")),
    )
    .await;
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
    audit_redis_event(
        &state,
        id,
        "redis_get_key_data",
        format!("get key data type={key_type} ttl={ttl_seconds}"),
        Some("GET_KEY_DATA".to_string()),
    )
    .await;
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
    let command_name = match &payload {
        RedisValueUpdate::String { .. } => "SET",
        RedisValueUpdate::Hash { .. } => "HSET",
        RedisValueUpdate::List { .. } => "RPUSH",
        RedisValueUpdate::Set { .. } => "SADD",
        RedisValueUpdate::Zset { .. } => "ZADD",
    };
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
    audit_redis_event(
        &state,
        id,
        "redis_set_key_data",
        "set key data success".to_string(),
        Some(command_name.to_string()),
    )
    .await;
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
    state.redis_set_ttl(id, key, ttl_seconds).await?;
    audit_redis_event(
        &state,
        id,
        "redis_set_ttl",
        format!("set ttl {:?}", ttl_seconds),
        Some("EXPIRE/PERSIST".to_string()),
    )
    .await;
    Ok(())
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
