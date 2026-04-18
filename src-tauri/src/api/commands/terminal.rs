//! 终端相关 Tauri 命令：连接、拉取输出、断开、发送按键、改窗口大小。
//!
//! 输出通过事件 `terminal-output` 推送（部分路径 Base64 编码原始字节）；调试信息走 `emit_debug`。

use base64::Engine;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use crate::app::AppState;

use super::command_sanitize::normalize_command_for_audit;
use super::common::emit_debug;

pub async fn connect_session(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    secret: Option<String>,
) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    emit_debug(&app, Some(id), "connect", "starting connect_session");
    if let Err(err) = state.connect_session(id, secret).await {
        let _ = state
            .record_session_audit(id, "connect_failed", None, format!("connect failed: {err}"))
            .await;
        return Err(err);
    }
    state.clear_audit_input_buffer(id).await;
    let _ = state
        .record_session_audit(id, "connect", None, "session connected".to_string())
        .await;
    emit_debug(
        &app,
        Some(id),
        "connect",
        "connect_session succeeded, start poll loop",
    );
    let hello = base64::engine::general_purpose::STANDARD.encode(b"[rshell] connected\r\n");
    let _ = app.emit(
        "terminal-output",
        serde_json::json!({ "sessionId": id.to_string(), "data": hello }),
    );
    Ok(())
}

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
                emit_debug(
                    &app,
                    Some(id),
                    "pull_output",
                    &format!("received {} bytes", bytes.len()),
                );
                Ok(Some(
                    base64::engine::general_purpose::STANDARD.encode(bytes),
                ))
            }
        }
        Err(err) => {
            emit_debug(&app, Some(id), "pull_output", &format!("error: {err}"));
            Err(err)
        }
    }
}

pub async fn disconnect_session(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    emit_debug(&app, Some(id), "disconnect", "disconnect requested");
    let result = state.disconnect_session(id).await;
    let detail = if result.is_ok() {
        "session disconnected".to_string()
    } else {
        "disconnect failed".to_string()
    };
    let event = if result.is_ok() {
        "disconnect"
    } else {
        "disconnect_failed"
    };
    let _ = state.record_session_audit(id, event, None, detail).await;
    state.clear_audit_input_buffer(id).await;
    result
}

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
    let audit_input = input.clone();
    let result = state.send_input(id, input).await;
    if result.is_ok() {
        let events = state.collect_input_events_for_audit(id, &audit_input).await;
        for raw in events.commands {
            let command = normalize_command_for_audit(&raw);
            let _ = state
                .record_session_audit(id, "command", Some(command), "command input".to_string())
                .await;
        }
        for control in events.control_events {
            let _ = state
                .record_session_audit(id, "control", None, format!("control key: {control}"))
                .await;
        }
    }
    result
}

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
