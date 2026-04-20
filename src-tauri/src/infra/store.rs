//! 会话、密钥与审计记录的本地 JSON 持久化（目录默认为用户配置下的 `rshell/`）。

use std::fs;
use std::path::PathBuf;

use thiserror::Error;
use uuid::Uuid;

use crate::domain::audit::AuditRecord;
use crate::domain::redis::RedisConnection;
use crate::domain::session::Session;
use crate::domain::zookeeper::ZookeeperConnection;
use crate::infra::store_audit;
use crate::infra::store_secret;

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("io error: {0}")]
    Io(String),
    #[error("serialization error: {0}")]
    Serialize(String),
}

#[derive(Clone)]
pub struct SessionStore {
    db_path: PathBuf,
    secret_path: PathBuf,
    audit_path: PathBuf,
    zk_db_path: PathBuf,
    zk_secret_path: PathBuf,
    redis_db_path: PathBuf,
    redis_secret_path: PathBuf,
}

impl SessionStore {
    pub fn new() -> Result<Self, StoreError> {
        let base = dirs::config_dir()
            .ok_or_else(|| StoreError::Io("unable to get config dir".to_string()))?
            .join("rshell");
        fs::create_dir_all(&base).map_err(|e| StoreError::Io(e.to_string()))?;
        Ok(Self {
            db_path: base.join("sessions.json"),
            secret_path: base.join("secrets.json"),
            audit_path: base.join("audit.json"),
            zk_db_path: base.join("zookeeper.json"),
            zk_secret_path: base.join("zookeeper_secrets.json"),
            redis_db_path: base.join("redis.json"),
            redis_secret_path: base.join("redis_secrets.json"),
        })
    }

    pub fn list(&self) -> Result<Vec<Session>, StoreError> {
        if !self.db_path.exists() {
            return Ok(vec![]);
        }
        let content =
            fs::read_to_string(&self.db_path).map_err(|e| StoreError::Io(e.to_string()))?;
        serde_json::from_str(&content).map_err(|e| StoreError::Serialize(e.to_string()))
    }

    pub fn save_all(&self, sessions: &[Session]) -> Result<(), StoreError> {
        let content = serde_json::to_string_pretty(sessions)
            .map_err(|e| StoreError::Serialize(e.to_string()))?;
        fs::write(&self.db_path, content).map_err(|e| StoreError::Io(e.to_string()))
    }

    pub fn list_zk(&self) -> Result<Vec<ZookeeperConnection>, StoreError> {
        if !self.zk_db_path.exists() {
            return Ok(vec![]);
        }
        let content =
            fs::read_to_string(&self.zk_db_path).map_err(|e| StoreError::Io(e.to_string()))?;
        serde_json::from_str(&content).map_err(|e| StoreError::Serialize(e.to_string()))
    }

    pub fn save_all_zk(&self, conns: &[ZookeeperConnection]) -> Result<(), StoreError> {
        let content = serde_json::to_string_pretty(conns)
            .map_err(|e| StoreError::Serialize(e.to_string()))?;
        fs::write(&self.zk_db_path, content).map_err(|e| StoreError::Io(e.to_string()))
    }

    pub fn set_zk_secret(&self, conn_id: Uuid, secret: &str) -> Result<(), StoreError> {
        store_secret::set_secret(&self.zk_secret_path, conn_id, secret)
    }

    pub fn get_zk_secret(&self, conn_id: Uuid) -> Result<Option<String>, StoreError> {
        store_secret::get_secret(&self.zk_secret_path, conn_id)
    }

    pub fn delete_zk_secret(&self, conn_id: Uuid) -> Result<(), StoreError> {
        store_secret::delete_secret(&self.zk_secret_path, conn_id)
    }

    pub fn list_redis(&self) -> Result<Vec<RedisConnection>, StoreError> {
        if !self.redis_db_path.exists() {
            return Ok(vec![]);
        }
        let content =
            fs::read_to_string(&self.redis_db_path).map_err(|e| StoreError::Io(e.to_string()))?;
        serde_json::from_str(&content).map_err(|e| StoreError::Serialize(e.to_string()))
    }

    pub fn save_all_redis(&self, conns: &[RedisConnection]) -> Result<(), StoreError> {
        let content = serde_json::to_string_pretty(conns)
            .map_err(|e| StoreError::Serialize(e.to_string()))?;
        fs::write(&self.redis_db_path, content).map_err(|e| StoreError::Io(e.to_string()))
    }

    pub fn set_redis_secret(&self, conn_id: Uuid, secret: &str) -> Result<(), StoreError> {
        store_secret::set_secret(&self.redis_secret_path, conn_id, secret)
    }

    pub fn get_redis_secret(&self, conn_id: Uuid) -> Result<Option<String>, StoreError> {
        store_secret::get_secret(&self.redis_secret_path, conn_id)
    }

    pub fn delete_redis_secret(&self, conn_id: Uuid) -> Result<(), StoreError> {
        store_secret::delete_secret(&self.redis_secret_path, conn_id)
    }

    pub fn set_secret(&self, session_id: Uuid, secret: &str) -> Result<(), StoreError> {
        store_secret::set_secret(&self.secret_path, session_id, secret)
    }

    pub fn get_secret(&self, session_id: Uuid) -> Result<Option<String>, StoreError> {
        store_secret::get_secret(&self.secret_path, session_id)
    }

    pub fn delete_secret(&self, session_id: Uuid) -> Result<(), StoreError> {
        store_secret::delete_secret(&self.secret_path, session_id)
    }

    pub fn list_audits(&self, limit: Option<usize>) -> Result<Vec<AuditRecord>, StoreError> {
        store_audit::list_audits(&self.audit_path, limit)
    }

    pub fn append_audit(&self, record: AuditRecord, max_keep: usize) -> Result<(), StoreError> {
        store_audit::append_audit(&self.audit_path, record, max_keep)
    }
}
