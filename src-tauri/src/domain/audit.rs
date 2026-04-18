//! 审计记录结构：连接、断开、命令等事件序列化后写入 `audit.json`。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditRecord {
    pub id: String,
    pub timestamp_ms: i64,
    pub session_id: Option<String>,
    pub session_name: Option<String>,
    pub host: Option<String>,
    pub event_type: String,
    pub command: Option<String>,
    pub detail: String,
}
