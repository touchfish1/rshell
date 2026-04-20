//! Zookeeper 连接配置模型：保存到磁盘的 `ZookeeperConnection` 与前端编辑用的 `ZookeeperConnectionInput`。

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZookeeperConnection {
    pub id: Uuid,
    pub name: String,
    /// Zookeeper connect string, e.g. `127.0.0.1:2181,127.0.0.2:2181/chroot`
    pub connect_string: String,
    /// Session timeout (ms)
    pub session_timeout_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZookeeperConnectionInput {
    pub name: String,
    pub connect_string: String,
    pub session_timeout_ms: Option<u64>,
}

impl ZookeeperConnectionInput {
    pub fn into_connection(self) -> ZookeeperConnection {
        ZookeeperConnection {
            id: Uuid::new_v4(),
            name: self.name,
            connect_string: self.connect_string,
            session_timeout_ms: self.session_timeout_ms.unwrap_or(10_000),
        }
    }
}

