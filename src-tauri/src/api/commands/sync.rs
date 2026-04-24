use tauri::State;

use crate::app::{AppState, PostgresqlSyncSummary};

pub async fn sync_connections_to_postgresql(
    state: State<'_, AppState>,
) -> Result<PostgresqlSyncSummary, String> {
    state.sync_connections_to_postgresql().await
}
