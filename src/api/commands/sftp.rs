use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::app::{AppState, SftpEntry, SftpTextReadResult};

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

pub async fn read_sftp_text_file(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    remote_path: String,
) -> Result<SftpTextReadResult, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    emit_debug(
        &app,
        Some(id),
        "sftp_text_read",
        &format!("open text file {}", remote_path),
    );
    state.read_sftp_text_file(id, remote_path).await
}

pub async fn save_sftp_text_file(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    remote_path: String,
    content: String,
) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    emit_debug(
        &app,
        Some(id),
        "sftp_text_save",
        &format!("save text file {}", remote_path),
    );
    state.save_sftp_text_file(id, remote_path, content).await
}

