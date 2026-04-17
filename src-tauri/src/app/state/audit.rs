use std::time::{SystemTime, UNIX_EPOCH};

use uuid::Uuid;

use crate::app::state::{AppState, AuditInputState};
use crate::domain::audit::AuditRecord;

const AUDIT_MAX_KEEP: usize = 5000;

pub struct AuditInputEvents {
    pub commands: Vec<String>,
    pub control_events: Vec<String>,
}

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
        let mut commands = Vec::new();
        let mut control_events = Vec::new();

        for ch in input.chars() {
            if state.esc_pending {
                if state.csi_pending {
                    // Consume CSI sequence until its final byte.
                    if ('@'..='~').contains(&ch) {
                        state.esc_pending = false;
                        state.csi_pending = false;
                    }
                    continue;
                }
                if ch == '[' {
                    state.csi_pending = true;
                    continue;
                }
                // Generic escape sequence, consume one trailing char and reset.
                state.esc_pending = false;
                continue;
            }

            match ch {
                '\u{0003}' => {
                    control_events.push("Ctrl+C".to_string());
                }
                '\u{0004}' => {
                    control_events.push("Ctrl+D".to_string());
                }
                '\u{000c}' => {
                    control_events.push("Ctrl+L".to_string());
                }
                '\u{001b}' => {
                    state.esc_pending = true;
                }
                '\r' | '\n' => {
                    let cmd = state.buffer.trim();
                    if !cmd.is_empty() {
                        commands.push(cmd.to_string());
                    }
                    state.buffer.clear();
                }
                '\u{0008}' | '\u{007f}' => {
                    state.buffer.pop();
                }
                '\t' => {
                    // Ignore tab completions in audit command text.
                }
                _ => {
                    if !ch.is_control() {
                        state.buffer.push(ch);
                    }
                }
            }
        }

        AuditInputEvents {
            commands,
            control_events,
        }
    }

    pub async fn clear_audit_input_buffer(&self, session_id: Uuid) {
        let mut buffers = self.audit_input_buffers.lock().await;
        buffers.remove(&session_id);
    }
}
