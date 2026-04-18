//! 会话、密钥与审计记录的本地 JSON 持久化（目录默认为用户配置下的 `rshell/`）。

use std::fs;
use std::path::PathBuf;

use thiserror::Error;
use uuid::Uuid;

use crate::domain::audit::AuditRecord;
use crate::domain::session::Session;

#[derive(Default, serde::Serialize, serde::Deserialize)]
struct SecretsFile {
    secrets: std::collections::HashMap<String, String>,
}

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
        })
    }

    pub fn list(&self) -> Result<Vec<Session>, StoreError> {
        if !self.db_path.exists() {
            return Ok(vec![]);
        }
        let content = fs::read_to_string(&self.db_path).map_err(|e| StoreError::Io(e.to_string()))?;
        serde_json::from_str(&content).map_err(|e| StoreError::Serialize(e.to_string()))
    }

    pub fn save_all(&self, sessions: &[Session]) -> Result<(), StoreError> {
        let content = serde_json::to_string_pretty(sessions)
            .map_err(|e| StoreError::Serialize(e.to_string()))?;
        fs::write(&self.db_path, content).map_err(|e| StoreError::Io(e.to_string()))
    }

    fn read_secrets(&self) -> Result<SecretsFile, StoreError> {
        if !self.secret_path.exists() {
            return Ok(SecretsFile::default());
        }
        let content =
            fs::read_to_string(&self.secret_path).map_err(|e| StoreError::Io(e.to_string()))?;
        serde_json::from_str(&content).map_err(|e| StoreError::Serialize(e.to_string()))
    }

    fn write_secrets(&self, data: &SecretsFile) -> Result<(), StoreError> {
        let content =
            serde_json::to_string_pretty(data).map_err(|e| StoreError::Serialize(e.to_string()))?;
        fs::write(&self.secret_path, content).map_err(|e| StoreError::Io(e.to_string()))
    }

    pub fn set_secret(&self, session_id: Uuid, secret: &str) -> Result<(), StoreError> {
        let mut data = self.read_secrets()?;
        data.secrets.insert(session_id.to_string(), secret.to_string());
        self.write_secrets(&data)
    }

    pub fn get_secret(&self, session_id: Uuid) -> Result<Option<String>, StoreError> {
        let data = self.read_secrets()?;
        Ok(data.secrets.get(&session_id.to_string()).cloned())
    }

    pub fn delete_secret(&self, session_id: Uuid) -> Result<(), StoreError> {
        let mut data = self.read_secrets()?;
        data.secrets.remove(&session_id.to_string());
        self.write_secrets(&data)
    }

    pub fn list_audits(&self, limit: Option<usize>) -> Result<Vec<AuditRecord>, StoreError> {
        if !self.audit_path.exists() {
            return Ok(vec![]);
        }
        let content = fs::read_to_string(&self.audit_path).map_err(|e| StoreError::Io(e.to_string()))?;
        let mut records: Vec<AuditRecord> =
            serde_json::from_str(&content).map_err(|e| StoreError::Serialize(e.to_string()))?;
        records.sort_by(|a, b| b.timestamp_ms.cmp(&a.timestamp_ms));
        if let Some(limit) = limit {
            if records.len() > limit {
                records.truncate(limit);
            }
        }
        Ok(records)
    }

    pub fn append_audit(&self, record: AuditRecord, max_keep: usize) -> Result<(), StoreError> {
        let mut records = self.list_audits(None)?;
        records.push(record);
        records.sort_by(|a, b| a.timestamp_ms.cmp(&b.timestamp_ms));
        if records.len() > max_keep {
            let to_drop = records.len() - max_keep;
            records.drain(0..to_drop);
        }
        let content =
            serde_json::to_string_pretty(&records).map_err(|e| StoreError::Serialize(e.to_string()))?;
        fs::write(&self.audit_path, content).map_err(|e| StoreError::Io(e.to_string()))
    }
}
