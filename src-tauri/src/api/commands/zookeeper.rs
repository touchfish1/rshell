//! Zookeeper：连接 CRUD、密钥、连接管理与节点浏览。

use base64::Engine;
use tauri::State;
use uuid::Uuid;

use crate::app::AppState;
use crate::domain::zookeeper::{ZookeeperConnection, ZookeeperConnectionInput};
use std::time::Duration;
use zookeeper_client::Client;

async fn audit_zk_event(
    state: &AppState,
    id: Uuid,
    event_type: &str,
    detail: String,
    command: Option<String>,
) {
    let meta = state
        .list_zookeeper_connections()
        .await
        .into_iter()
        .find(|item| item.id == id);
    let session_name = meta.as_ref().map(|item| item.name.clone());
    let host = meta.as_ref().map(|item| item.connect_string.clone());
    let _ = state
        .record_custom_audit(event_type, Some(id), session_name, host, command, detail)
        .await;
}

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
    match state.connect_zookeeper(id, secret).await {
        Ok(_) => {
            audit_zk_event(&state, id, "zk_connect", "zookeeper connected".to_string(), None).await;
            Ok(())
        }
        Err(err) => {
            audit_zk_event(
                &state,
                id,
                "zk_connect_failed",
                format!("zookeeper connect failed: {err}"),
                None,
            )
            .await;
            Err(err)
        }
    }
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
    match state.disconnect_zookeeper(id).await {
        Ok(_) => {
            audit_zk_event(
                &state,
                id,
                "zk_disconnect",
                "zookeeper disconnected".to_string(),
                None,
            )
            .await;
            Ok(())
        }
        Err(err) => {
            audit_zk_event(
                &state,
                id,
                "zk_disconnect_failed",
                format!("zookeeper disconnect failed: {err}"),
                None,
            )
            .await;
            Err(err)
        }
    }
}

pub async fn zk_list_children(
    state: State<'_, AppState>,
    id: String,
    path: String,
) -> Result<Vec<String>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let op_path = path.clone();
    match state.zk_list_children(id, path).await {
        Ok(children) => {
            audit_zk_event(
                &state,
                id,
                "zk_list_children",
                format!("list children path={op_path} count={}", children.len()),
                None,
            )
            .await;
            Ok(children)
        }
        Err(err) => {
            audit_zk_event(
                &state,
                id,
                "zk_list_children_failed",
                format!("list children failed path={op_path}: {err}"),
                None,
            )
            .await;
            Err(err)
        }
    }
}

pub async fn zk_get_data(state: State<'_, AppState>, id: String, path: String) -> Result<ZkNodeData, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let op_path = path.clone();
    let (data, _stat) = match state.zk_get_data(id, path).await {
        Ok(res) => res,
        Err(err) => {
            audit_zk_event(
                &state,
                id,
                "zk_get_data_failed",
                format!("get data failed path={op_path}: {err}"),
                None,
            )
            .await;
            return Err(err);
        }
    };
    let data_utf8 = String::from_utf8(data.clone()).ok();
    let data_base64 = base64::engine::general_purpose::STANDARD.encode(&data);
    audit_zk_event(
        &state,
        id,
        "zk_get_data",
        format!("get data path={op_path} bytes={}", data.len()),
        None,
    )
    .await;
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
    let op_path = path.clone();
    let payload_len = data_utf8.len();
    match state.zk_set_data(id, path, data_utf8.into_bytes()).await {
        Ok(_) => {
            audit_zk_event(
                &state,
                id,
                "zk_set_data",
                format!("set data path={op_path} bytes={payload_len}"),
                None,
            )
            .await;
            Ok(())
        }
        Err(err) => {
            audit_zk_event(
                &state,
                id,
                "zk_set_data_failed",
                format!("set data failed path={op_path}: {err}"),
                None,
            )
            .await;
            Err(err)
        }
    }
}

