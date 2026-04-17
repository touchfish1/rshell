use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::app::{AppState, HostMetrics};

use super::common::emit_debug;

pub async fn get_host_metrics(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<HostMetrics, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    emit_debug(&app, Some(id), "metrics", "collect host metrics");
    state.get_host_metrics(id).await
}

