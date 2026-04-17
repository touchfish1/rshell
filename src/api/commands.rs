mod common;
mod metrics;
mod sessions;
mod sftp;
mod system;
mod terminal;

use tauri::{AppHandle, State};

use crate::app::{AppState, AuditRecord, HostMetrics, SftpEntry, SftpTextReadResult};
use crate::domain::session::{Session, SessionInput};
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration};

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
pub async fn get_session_secret(state: State<'_, AppState>, id: String) -> Result<Option<String>, String> {
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
pub async fn pull_output(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<Option<String>, String> {
    terminal::pull_output(app, state, id).await
}

#[tauri::command]
pub async fn disconnect_session(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<(), String> {
    terminal::disconnect_session(app, state, id).await
}

#[tauri::command]
pub async fn send_input(app: AppHandle, state: State<'_, AppState>, id: String, input: String) -> Result<(), String> {
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
pub async fn open_in_file_manager(path: String) -> Result<(), String> {
    system::open_in_file_manager(path).await
}

#[tauri::command]
pub async fn open_external_url(url: String) -> Result<(), String> {
    system::open_external_url(url).await
}

#[tauri::command]
pub async fn get_host_metrics(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<HostMetrics, String> {
    metrics::get_host_metrics(app, state, id).await
}

#[tauri::command]
pub async fn test_host_reachability(host: String, port: u16, timeout_ms: Option<u64>) -> Result<bool, String> {
    if host.trim().is_empty() {
        return Err("host is required".to_string());
    }
    let addr = format!("{}:{}", host.trim(), port);
    let duration = Duration::from_millis(timeout_ms.unwrap_or(2000).clamp(100, 10000));
    let result = timeout(duration, TcpStream::connect(addr)).await;
    Ok(matches!(result, Ok(Ok(_))))
}

#[tauri::command]
pub async fn list_audits(state: State<'_, AppState>, limit: Option<usize>) -> Result<Vec<AuditRecord>, String> {
    state.list_audits(limit).await
}
