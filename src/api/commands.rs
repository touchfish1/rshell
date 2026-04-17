use base64::Engine;
use std::path::Path;
use std::process::Command;
use tauri::{AppHandle, Emitter, State};
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration};
use uuid::Uuid;

use crate::app::AppState;
use crate::app::SftpEntry;
use crate::domain::session::{Session, SessionInput};

fn emit_debug(app: &AppHandle, session_id: Option<Uuid>, stage: &str, message: &str) {
    let sid = session_id
        .map(|id| id.to_string())
        .unwrap_or_else(|| "-".to_string());
    let text = format!("[backend][{stage}][{sid}] {message}");
    eprintln!("{text}");
    let _ = app.emit(
        "debug-log",
        serde_json::json!({
            "sessionId": sid,
            "stage": stage,
            "message": message
        }),
    );
}

#[tauri::command]
pub async fn list_sessions(state: State<'_, AppState>) -> Result<Vec<Session>, String> {
    Ok(state.list_sessions().await)
}

#[tauri::command]
pub async fn create_session(
    state: State<'_, AppState>,
    input: SessionInput,
    secret: Option<String>,
) -> Result<Session, String> {
    state.create_session(input, secret).await
}

#[tauri::command]
pub async fn update_session(
    state: State<'_, AppState>,
    id: String,
    input: SessionInput,
    secret: Option<String>,
) -> Result<Session, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.update_session(id, input, secret).await
}

#[tauri::command]
pub async fn delete_session(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.delete_session(id).await
}

#[tauri::command]
pub async fn has_session_secret(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.has_secret(id).await
}

#[tauri::command]
pub async fn get_session_secret(state: State<'_, AppState>, id: String) -> Result<Option<String>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.get_secret(id).await
}

#[tauri::command]
pub async fn connect_session(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    secret: Option<String>,
) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    emit_debug(&app, Some(id), "connect", "starting connect_session");
    state.connect_session(id, secret).await?;
    emit_debug(&app, Some(id), "connect", "connect_session succeeded, start poll loop");
    // 先推一条本地消息，验证 UI 事件通道正常
    let hello = base64::engine::general_purpose::STANDARD.encode(b"[rshell] connected\r\n");
    let _ = app.emit(
        "terminal-output",
        serde_json::json!({ "sessionId": id.to_string(), "data": hello }),
    );
    Ok(())
}

#[tauri::command]
pub async fn pull_output(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<String>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    match state.poll_output(id).await {
        Ok(bytes) => {
            if bytes.is_empty() {
                Ok(None)
            } else {
                emit_debug(&app, Some(id), "pull_output", &format!("received {} bytes", bytes.len()));
                Ok(Some(base64::engine::general_purpose::STANDARD.encode(bytes)))
            }
        }
        Err(err) => {
            emit_debug(&app, Some(id), "pull_output", &format!("error: {err}"));
            Err(err)
        }
    }
}

#[tauri::command]
pub async fn disconnect_session(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    emit_debug(&app, Some(id), "disconnect", "disconnect requested");
    state.disconnect_session(id).await
}

#[tauri::command]
pub async fn send_input(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    input: String,
) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    emit_debug(
        &app,
        Some(id),
        "send_input",
        &format!("sending {} bytes", input.as_bytes().len()),
    );
    state.send_input(id, input).await
}

#[tauri::command]
pub async fn resize_terminal(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    emit_debug(
        &app,
        Some(id),
        "resize",
        &format!("resize to {}x{}", cols, rows),
    );
    state.resize_terminal(id, cols, rows).await
}

#[tauri::command]
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

#[tauri::command]
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

#[tauri::command]
pub async fn test_host_reachability(
    host: String,
    port: u16,
    timeout_ms: Option<u64>,
) -> Result<bool, String> {
    if host.trim().is_empty() {
        return Err("host is required".to_string());
    }
    let addr = format!("{}:{}", host.trim(), port);
    let duration = Duration::from_millis(timeout_ms.unwrap_or(2000).clamp(100, 10000));
    let result = timeout(duration, TcpStream::connect(addr)).await;
    Ok(matches!(result, Ok(Ok(_))))
}

#[tauri::command]
pub async fn open_in_file_manager(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err("path does not exist".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg("/select,")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("open explorer failed: {e}"))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let status = Command::new("open")
            .arg("-R")
            .arg(&path)
            .status()
            .map_err(|e| format!("open finder failed: {e}"))?;
        if status.success() {
            return Ok(());
        }
        return Err("open finder failed".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        let parent = p.parent().ok_or_else(|| "invalid parent path".to_string())?;
        let status = Command::new("xdg-open")
            .arg(parent)
            .status()
            .map_err(|e| format!("open file manager failed: {e}"))?;
        if status.success() {
            return Ok(());
        }
        return Err("open file manager failed".to_string());
    }

    #[allow(unreachable_code)]
    Err("unsupported platform".to_string())
}
