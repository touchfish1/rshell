//! Etcd：连接 CRUD、密钥、连接管理与 key 浏览。

use tauri::State;
use uuid::Uuid;

use crate::domain::etcd::EtcdKeyValue;
use crate::app::AppState;
use crate::domain::etcd::{EtcdConnection, EtcdConnectionInput};

pub async fn list_etcd_connections(
    state: State<'_, AppState>,
) -> Result<Vec<EtcdConnection>, String> {
    Ok(state.list_etcd_connections().await)
}

pub async fn create_etcd_connection(
    state: State<'_, AppState>,
    input: EtcdConnectionInput,
    secret: Option<String>,
) -> Result<EtcdConnection, String> {
    state.create_etcd_connection(input, secret).await
}

pub async fn update_etcd_connection(
    state: State<'_, AppState>,
    id: String,
    input: EtcdConnectionInput,
    secret: Option<String>,
) -> Result<EtcdConnection, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.update_etcd_connection(id, input, secret).await
}

pub async fn delete_etcd_connection(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.delete_etcd_connection(id).await
}

pub async fn has_etcd_secret(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.has_etcd_secret(id).await
}

pub async fn get_etcd_secret(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<String>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.get_etcd_secret(id).await
}

pub async fn connect_etcd(
    state: State<'_, AppState>,
    id: String,
    secret: Option<String>,
) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.connect_etcd(id, secret).await
}

pub async fn disconnect_etcd(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.disconnect_etcd(id).await
}

pub async fn etcd_list_keys(
    state: State<'_, AppState>,
    id: String,
    prefix: String,
) -> Result<Vec<String>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.etcd_list_keys(id, prefix).await
}

pub async fn etcd_get_value(
    state: State<'_, AppState>,
    id: String,
    key: String,
) -> Result<Option<EtcdKeyValue>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.etcd_get_value(id, key).await
}

pub async fn etcd_set_value(
    state: State<'_, AppState>,
    id: String,
    key: String,
    value: String,
) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.etcd_set_value(id, key, value).await
}

pub async fn etcd_delete_key(
    state: State<'_, AppState>,
    id: String,
    key: String,
) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.etcd_delete_key(id, key).await
}
