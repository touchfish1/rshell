use base64::Engine;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use crate::app::AppState;

use super::common::emit_debug;

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
    let hello = base64::engine::general_purpose::STANDARD.encode(b"[rshell] connected\r\n");
    let _ = app.emit(
        "terminal-output",
        serde_json::json!({ "sessionId": id.to_string(), "data": hello }),
    );
    Ok(())
}

pub async fn pull_output(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<Option<String>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    match state.poll_output(id).await {
        Ok(bytes) => {
            if bytes.is_empty() {
                Ok(None)
            } else {
                emit_debug(
                    &app,
                    Some(id),
                    "pull_output",
                    &format!("received {} bytes", bytes.len()),
                );
                Ok(Some(base64::engine::general_purpose::STANDARD.encode(bytes)))
            }
        }
        Err(err) => {
            emit_debug(&app, Some(id), "pull_output", &format!("error: {err}"));
            Err(err)
        }
    }
}

pub async fn disconnect_session(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    emit_debug(&app, Some(id), "disconnect", "disconnect requested");
    state.disconnect_session(id).await
}

pub async fn send_input(app: AppHandle, state: State<'_, AppState>, id: String, input: String) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    emit_debug(
        &app,
        Some(id),
        "send_input",
        &format!("sending {} bytes", input.as_bytes().len()),
    );
    state.send_input(id, input).await
}

pub async fn resize_terminal(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    emit_debug(&app, Some(id), "resize", &format!("resize to {}x{}", cols, rows));
    state.resize_terminal(id, cols, rows).await
}

