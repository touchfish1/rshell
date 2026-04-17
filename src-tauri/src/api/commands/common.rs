use tauri::{AppHandle, Emitter};
use uuid::Uuid;

pub fn emit_debug(app: &AppHandle, session_id: Option<Uuid>, stage: &str, message: &str) {
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

