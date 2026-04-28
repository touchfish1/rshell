//! Etcd 连接配置模型：保存到磁盘的 `EtcdConnection` 与前端编辑用的 `EtcdConnectionInput`。

/// etcd key-value 查询结果。
#[derive(Debug, Clone, serde::Serialize)]
pub struct EtcdKeyValue {
    pub key: String,
    pub value: String,
    pub create_revision: i64,
    pub mod_revision: i64,
}

use serde::{Deserialize, Serialize};
use uuid::Uuid;

fn default_environment() -> String {
    "default".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EtcdConnection {
    pub id: Uuid,
    #[serde(default = "default_environment")]
    pub environment: String,
    pub name: String,
    /// Comma-separated etcd endpoints, e.g. `http://127.0.0.1:2379,http://127.0.0.2:2379`
    pub endpoints: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EtcdConnectionInput {
    pub name: String,
    pub endpoints: String,
}

impl EtcdConnectionInput {
    pub fn into_connection(self) -> EtcdConnection {
        EtcdConnection {
            id: Uuid::new_v4(),
            environment: default_environment(),
            name: self.name,
            endpoints: self.endpoints,
        }
    }
}
