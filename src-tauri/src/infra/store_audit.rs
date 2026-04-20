use std::fs;
use std::path::Path;

use super::store::StoreError;
use crate::domain::audit::AuditRecord;

pub(crate) fn list_audits(audit_path: &Path, limit: Option<usize>) -> Result<Vec<AuditRecord>, StoreError> {
    if !audit_path.exists() {
        return Ok(vec![]);
    }
    let content = fs::read_to_string(audit_path).map_err(|e| StoreError::Io(e.to_string()))?;
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

pub(crate) fn append_audit(audit_path: &Path, record: AuditRecord, max_keep: usize) -> Result<(), StoreError> {
    let mut records = list_audits(audit_path, None)?;
    records.push(record);
    records.sort_by(|a, b| a.timestamp_ms.cmp(&b.timestamp_ms));
    if records.len() > max_keep {
        let to_drop = records.len() - max_keep;
        records.drain(0..to_drop);
    }
    let content =
        serde_json::to_string_pretty(&records).map_err(|e| StoreError::Serialize(e.to_string()))?;
    fs::write(audit_path, content).map_err(|e| StoreError::Io(e.to_string()))
}

