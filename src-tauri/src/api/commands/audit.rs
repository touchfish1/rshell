use tauri::State;

use crate::app::{AppState, AuditRecord};

pub async fn list_audits(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<AuditRecord>, String> {
    state.list_audits(limit).await
}

