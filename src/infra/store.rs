use std::fs;
use std::path::PathBuf;

use keyring::Entry;
use keyring::Error as KeyringError;
use thiserror::Error;
use uuid::Uuid;

use crate::domain::session::Session;

const SERVICE_NAME: &str = "rshell";

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("io error: {0}")]
    Io(String),
    #[error("serialization error: {0}")]
    Serialize(String),
    #[error("secret storage error: {0}")]
    Secret(String),
}

#[derive(Clone)]
pub struct SessionStore {
    db_path: PathBuf,
}

impl SessionStore {
    pub fn new() -> Result<Self, StoreError> {
        let base = dirs::config_dir()
            .ok_or_else(|| StoreError::Io("unable to get config dir".to_string()))?
            .join("rshell");
        fs::create_dir_all(&base).map_err(|e| StoreError::Io(e.to_string()))?;
        Ok(Self {
            db_path: base.join("sessions.json"),
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

    pub fn set_secret(&self, session_id: Uuid, secret: &str) -> Result<(), StoreError> {
        Entry::new(SERVICE_NAME, &session_id.to_string())
            .map_err(|e| StoreError::Secret(e.to_string()))?
            .set_password(secret)
            .map_err(|e| StoreError::Secret(e.to_string()))
    }

    pub fn get_secret(&self, session_id: Uuid) -> Result<Option<String>, StoreError> {
        let entry = Entry::new(SERVICE_NAME, &session_id.to_string())
            .map_err(|e| StoreError::Secret(e.to_string()))?;
        match entry.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(KeyringError::NoEntry) => Ok(None),
            Err(e) => Err(StoreError::Secret(e.to_string())),
        }
    }

    pub fn delete_secret(&self, session_id: Uuid) -> Result<(), StoreError> {
        let entry = Entry::new(SERVICE_NAME, &session_id.to_string())
            .map_err(|e| StoreError::Secret(e.to_string()))?;
        let _ = entry.delete_credential();
        Ok(())
    }
}
