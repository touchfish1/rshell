//! 应用核心业务层：`AppState` 持有会话列表、活跃终端连接、审计与 SFTP 等状态。

mod state;

pub use crate::domain::audit::AuditRecord;
pub use state::{AppState, HostMetrics, SftpEntry, SftpTextReadResult};

#[cfg(test)]
mod state_tests;
