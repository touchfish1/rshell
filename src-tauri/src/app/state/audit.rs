use std::time::{SystemTime, UNIX_EPOCH};

use uuid::Uuid;

use crate::app::state::audit_parse::{collect_audit_input_events, AuditInputEvents};
use crate::app::state::{AppState, AuditInputState};
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

    pub async fn collect_input_events_for_audit(
        &self,
        session_id: Uuid,
        input: &str,
    ) -> AuditInputEvents {
        let mut buffers = self.audit_input_buffers.lock().await;
        let state = buffers.entry(session_id).or_insert_with(AuditInputState::default);
        collect_audit_input_events(state, input)
    }

    pub async fn clear_audit_input_buffer(&self, session_id: Uuid) {
        let mut buffers = self.audit_input_buffers.lock().await;
        buffers.remove(&session_id);
    }
}
