use uuid::Uuid;

use crate::app::AppState;

pub async fn audit_mysql_event(
    state: &AppState,
    id: Uuid,
    event_type: &str,
    detail: String,
    command: Option<String>,
) {
    let meta = state
        .list_mysql_connections()
        .await
        .into_iter()
        .find(|item| item.id == id);
    let session_name = meta.as_ref().map(|item| item.name.clone());
    let host = meta
        .as_ref()
        .map(|item| format!("{}:{}", item.host.trim(), item.port));
    let _ = state
        .record_custom_audit(event_type, Some(id), session_name, host, command, detail)
        .await;
}
