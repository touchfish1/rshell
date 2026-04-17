use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::app::{AppState, SftpEntry};

use super::common::emit_debug;

pub async fn list_sftp_dir(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    path: Option<String>,
) -> Result<Vec<SftpEntry>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    emit_debug(
        &app,
        Some(id),
        "sftp",
        &format!("list dir {}", path.clone().unwrap_or_else(|| ".".to_string())),
    );
    state.list_sftp_dir(id, path).await
}

pub async fn download_sftp_file(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    remote_path: String,
) -> Result<String, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    emit_debug(
        &app,
        Some(id),
        "sftp_download",
        &format!("download file {}", remote_path),
    );
    state.download_sftp_file(id, remote_path).await
}

