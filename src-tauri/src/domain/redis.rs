//! Redis 连接配置模型：保存到磁盘的 `RedisConnection` 与前端编辑用的 `RedisConnectionInput`。

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisConnection {
    pub id: Uuid,
    pub name: String,
    /// Redis address, e.g. `127.0.0.1:6379`
    pub address: String,
    pub db: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisConnectionInput {
    pub name: String,
    pub address: String,
    pub db: Option<u32>,
}

impl RedisConnectionInput {
    pub fn into_connection(self) -> RedisConnection {
        RedisConnection {
            id: Uuid::new_v4(),
            name: self.name,
            address: self.address,
            db: self.db.unwrap_or(0),
        }
    }
}
