use base64::Engine;
use regex::{Captures, Regex};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use crate::app::AppState;

use super::common::emit_debug;

fn normalize_command_for_audit(input: &str) -> String {
    let mut cmd = sanitize_command(input.trim());
    if cmd.len() > 240 {
        cmd.truncate(240);
        cmd.push_str("...");
    }
    cmd
}

fn is_sensitive_key(key: &str) -> bool {
    let lower = key.to_ascii_lowercase();
    lower.contains("password")
        || lower.contains("passwd")
        || lower.contains("pwd")
        || lower.contains("token")
        || lower.contains("secret")
        || lower.contains("apikey")
        || lower.contains("api_key")
        || lower.contains("access_key")
}

fn is_sensitive_flag(token: &str) -> bool {
    let lower = token.to_ascii_lowercase();
    matches!(
        lower.as_str(),
        "-p" | "--p" | "--pw" | "--pwd" | "--password" | "--passwd" | "--token" | "--secret" | "--apikey"
            | "--api-key"
    )
}

fn sanitize_token(token: &str) -> String {
    if let Some((k, _)) = token.split_once('=') {
        if is_sensitive_key(k) {
            return format!("{k}=***");
        }
    }
    token.to_string()
}

fn sanitize_command(command: &str) -> String {
    let mut out = Vec::new();
    let mut next_mask = false;
    for raw in command.split_whitespace() {
        if next_mask {
            out.push("***".to_string());
            next_mask = false;
            continue;
        }
        if is_sensitive_flag(raw) {
            out.push(raw.to_string());
            next_mask = true;
            continue;
        }
        out.push(sanitize_token(raw));
    }
    let masked = if out.is_empty() {
        command.to_string()
    } else {
        out.join(" ")
    };
    sanitize_payload_pairs(&masked)
}

fn sanitize_payload_pairs(input: &str) -> String {
    // key=value style, including URL query/body fragments.
    let key_value_re = Regex::new(
        r#"(?i)\b(password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key)\b\s*=\s*([^\s&"',}]+|"[^"]*"|'[^']*')"#,
    )
    .expect("valid key=value masking regex");
    let pass1 = key_value_re.replace_all(input, |caps: &Captures| format!("{}=***", &caps[1]));

    // JSON-like "key":"value" or key: value fragments.
    let json_pair_re = Regex::new(
        r#"(?i)(["']?(password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key)["']?\s*:\s*)("[^"]*"|'[^']*'|[^\s,}\]]+)"#,
    )
    .expect("valid json-like masking regex");
    json_pair_re
        .replace_all(&pass1, |caps: &Captures| format!("{}\"***\"", &caps[1]))
        .to_string()
}

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
    let result = state.disconnect_session(id).await;
    let detail = if result.is_ok() {
        "session disconnected".to_string()
    } else {
        "disconnect failed".to_string()
    };
    let event = if result.is_ok() { "disconnect" } else { "disconnect_failed" };
    let _ = state.record_session_audit(id, event, None, detail).await;
    state.clear_audit_input_buffer(id).await;
    result
}

pub async fn send_input(app: AppHandle, state: State<'_, AppState>, id: String, input: String) -> Result<(), String> {
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
    emit_debug(&app, Some(id), "resize", &format!("resize to {}x{}", cols, rows));
    state.resize_terminal(id, cols, rows).await
}

