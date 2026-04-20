//! Zookeeper：连接 CRUD、密钥、连接管理与节点浏览。

use base64::Engine;
use tauri::State;
use uuid::Uuid;

use crate::app::AppState;
use crate::domain::zookeeper::{ZookeeperConnection, ZookeeperConnectionInput};
use std::time::Duration;
use zookeeper_client::Client;

#[derive(Debug, Clone, serde::Serialize)]
pub struct ZkNodeData {
    pub data_base64: String,
    pub data_utf8: Option<String>,
    pub total_bytes: u64,
}

pub async fn list_zookeeper_connections(
    state: State<'_, AppState>,
) -> Result<Vec<ZookeeperConnection>, String> {
    Ok(state.list_zookeeper_connections().await)
}

pub async fn create_zookeeper_connection(
    state: State<'_, AppState>,
    input: ZookeeperConnectionInput,
    secret: Option<String>,
) -> Result<ZookeeperConnection, String> {
    state.create_zookeeper_connection(input, secret).await
}

pub async fn update_zookeeper_connection(
    state: State<'_, AppState>,
    id: String,
    input: ZookeeperConnectionInput,
    secret: Option<String>,
) -> Result<ZookeeperConnection, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.update_zookeeper_connection(id, input, secret).await
}

pub async fn delete_zookeeper_connection(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.delete_zookeeper_connection(id).await
}

pub async fn has_zookeeper_secret(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.has_zookeeper_secret(id).await
}

pub async fn get_zookeeper_secret(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<String>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.get_zookeeper_secret(id).await
}

pub async fn connect_zookeeper(
    state: State<'_, AppState>,
    id: String,
    secret: Option<String>,
) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.connect_zookeeper(id, secret).await
}

pub async fn test_zookeeper_connection(
    connect_string: String,
    session_timeout_ms: Option<u64>,
    secret: Option<String>,
) -> Result<(), String> {
    let mut connector =
        Client::connector().with_session_timeout(Duration::from_millis(session_timeout_ms.unwrap_or(10_000)));
    if let Some(secret) = secret.clone() {
        if !secret.trim().is_empty() {
            connector = connector.with_auth("digest", secret.as_bytes());
        }
    }
    let client = connector.connect(&connect_string).await.map_err(|e| e.to_string())?;
    client.list_children("/").await.map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn disconnect_zookeeper(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.disconnect_zookeeper(id).await
}

pub async fn zk_list_children(
    state: State<'_, AppState>,
    id: String,
    path: String,
) -> Result<Vec<String>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.zk_list_children(id, path).await
}

pub async fn zk_get_data(state: State<'_, AppState>, id: String, path: String) -> Result<ZkNodeData, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let (data, _stat) = state.zk_get_data(id, path).await?;
    let data_utf8 = String::from_utf8(data.clone()).ok();
    let data_base64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(ZkNodeData {
        data_base64,
        data_utf8,
        total_bytes: data.len() as u64,
    })
}

pub async fn zk_set_data(
    state: State<'_, AppState>,
    id: String,
    path: String,
    data_utf8: String,
) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.zk_set_data(id, path, data_utf8.into_bytes()).await
}

