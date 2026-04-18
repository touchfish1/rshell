//! 会话配置模型：保存到磁盘的 `Session` 与前端编辑用的 `SessionInput`。

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Protocol {
    Ssh,
    Telnet,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: Uuid,
    pub name: String,
    pub protocol: Protocol,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub encoding: String,
    pub keepalive_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInput {
    pub name: String,
    pub protocol: Protocol,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub encoding: Option<String>,
    pub keepalive_secs: Option<u64>,
}

impl SessionInput {
    pub fn into_session(self) -> Session {
        Session {
            id: Uuid::new_v4(),
            name: self.name,
            protocol: self.protocol,
            host: self.host,
            port: self.port,
            username: self.username,
            encoding: self.encoding.unwrap_or_else(|| "utf-8".to_string()),
            keepalive_secs: self.keepalive_secs.unwrap_or(30),
        }
    }
}
