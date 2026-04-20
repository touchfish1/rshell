use std::collections::HashMap;
use std::fs;
use std::path::Path;
use uuid::Uuid;

use super::store::StoreError;

#[derive(Default, serde::Serialize, serde::Deserialize)]
pub(crate) struct SecretsFile {
    pub(crate) secrets: HashMap<String, String>,
}

pub(crate) fn read_secrets(secret_path: &Path) -> Result<SecretsFile, StoreError> {
    if !secret_path.exists() {
        return Ok(SecretsFile::default());
    }
    let content = fs::read_to_string(secret_path).map_err(|e| StoreError::Io(e.to_string()))?;
    serde_json::from_str(&content).map_err(|e| StoreError::Serialize(e.to_string()))
}

pub(crate) fn write_secrets(secret_path: &Path, data: &SecretsFile) -> Result<(), StoreError> {
    let content =
        serde_json::to_string_pretty(data).map_err(|e| StoreError::Serialize(e.to_string()))?;
    fs::write(secret_path, content).map_err(|e| StoreError::Io(e.to_string()))
}

pub(crate) fn get_secret(secret_path: &Path, session_id: Uuid) -> Result<Option<String>, StoreError> {
    let data = read_secrets(secret_path)?;
    Ok(data.secrets.get(&session_id.to_string()).cloned())
}

pub(crate) fn set_secret(secret_path: &Path, session_id: Uuid, secret: &str) -> Result<(), StoreError> {
    let mut data = read_secrets(secret_path)?;
    data.secrets
        .insert(session_id.to_string(), secret.to_string());
    write_secrets(secret_path, &data)
}

pub(crate) fn delete_secret(secret_path: &Path, session_id: Uuid) -> Result<(), StoreError> {
    let mut data = read_secrets(secret_path)?;
    data.secrets.remove(&session_id.to_string());
    write_secrets(secret_path, &data)
}

