use std::time::{SystemTime, UNIX_EPOCH};

use uuid::Uuid;

use crate::app::state::AppState;
use crate::domain::audit::AuditRecord;

const AUDIT_MAX_KEEP: usize = 5000;

impl AppState {
    pub async fn list_audits(&self, limit: Option<usize>) -> Result<Vec<AuditRecord>, String> {
        self.store.list_audits(limit).map_err(|e| e.to_string())
    }

    pub async fn record_session_audit(
        &self,
        session_id: Uuid,
        event_type: &str,
        command: Option<String>,
        detail: String,
    ) -> Result<(), String> {
        let session = self
            .sessions
            .lock()
            .await
            .iter()
            .find(|s| s.id == session_id)
            .cloned();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_millis() as i64;
        let record = AuditRecord {
            id: Uuid::new_v4().to_string(),
            timestamp_ms: now,
            session_id: Some(session_id.to_string()),
            session_name: session.as_ref().map(|s| s.name.clone()),
            host: session.map(|s| s.host),
            event_type: event_type.to_string(),
            command,
            detail,
        };
        self.store
            .append_audit(record, AUDIT_MAX_KEEP)
            .map_err(|e| e.to_string())
    }
}
