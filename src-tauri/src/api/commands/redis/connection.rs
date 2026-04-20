use tauri::State;
use uuid::Uuid;

use crate::app::AppState;
use crate::domain::redis::{RedisConnection, RedisConnectionInput};

use super::audit::audit_redis_event;

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
    match state.connect_redis(id, secret).await {
        Ok(_) => {
            audit_redis_event(
                &state,
                id,
                "redis_connect",
                "redis connected".to_string(),
                Some("CONNECT".to_string()),
            )
            .await;
            Ok(())
        }
        Err(err) => {
            audit_redis_event(
                &state,
                id,
                "redis_connect_failed",
                format!("redis connect failed: {err}"),
                Some("CONNECT".to_string()),
            )
            .await;
            Err(err)
        }
    }
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
    match state.disconnect_redis(id).await {
        Ok(_) => {
            audit_redis_event(
                &state,
                id,
                "redis_disconnect",
                "redis disconnected".to_string(),
                Some("DISCONNECT".to_string()),
            )
            .await;
            Ok(())
        }
        Err(err) => {
            audit_redis_event(
                &state,
                id,
                "redis_disconnect_failed",
                format!("redis disconnect failed: {err}"),
                Some("DISCONNECT".to_string()),
            )
            .await;
            Err(err)
        }
    }
}

pub async fn redis_list_keys(
    state: State<'_, AppState>,
    id: String,
    pattern: Option<String>,
) -> Result<Vec<String>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.redis_list_keys(id, pattern).await
}
