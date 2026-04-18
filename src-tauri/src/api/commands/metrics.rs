//! 通过 SSH 在远端执行轻量命令采集 CPU/内存/磁盘（仅 SSH 会话）。

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
