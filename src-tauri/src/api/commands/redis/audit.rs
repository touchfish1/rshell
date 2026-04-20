use uuid::Uuid;

use crate::app::AppState;

pub async fn audit_redis_event(
    state: &AppState,
    id: Uuid,
    event_type: &str,
    detail: String,
    command: Option<String>,
) {
    let meta = state
        .list_redis_connections()
        .await
        .into_iter()
        .find(|item| item.id == id);
    let session_name = meta.as_ref().map(|item| item.name.clone());
    let host = meta.as_ref().map(|item| item.address.clone());
    let _ = state
        .record_custom_audit(event_type, Some(id), session_name, host, command, detail)
        .await;
}
