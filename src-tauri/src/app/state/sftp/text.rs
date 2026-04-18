//! SFTP 文本读写：大小限制、分块读取，供内置编辑器避免一次性加载过大文件。

use std::io::{Read, Write};
use std::path::Path;

use uuid::Uuid;

use crate::app::state::AppState;
use crate::domain::session::Protocol;

const EDITOR_MAX_BYTES: u64 = 5 * 1024 * 1024;
const EDITOR_READ_CHUNK_BYTES: u64 = 512 * 1024;

#[derive(Debug, Clone, serde::Serialize)]
pub struct SftpTextReadResult {
    pub content: String,
    pub total_bytes: u64,
    pub loaded_bytes: u64,
    pub truncated: bool,
    pub too_large: bool,
}

impl AppState {
    pub async fn read_sftp_text_file(
        &self,
        id: Uuid,
        remote_path: String,
    ) -> Result<SftpTextReadResult, String> {
        let session = self.find_session(id).await?;
        if !matches!(session.protocol, Protocol::Ssh) {
            return Err("text editor only supports ssh sessions".to_string());
        }
        let secret = self
            .store
            .get_secret(id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "missing SSH password".to_string())?;
        let ssh = self.open_ssh_session(&session, &secret)?;
        let sftp = ssh.sftp().map_err(|e| format!("sftp init failed: {e}"))?;

        let remote = Path::new(&remote_path);
        let remote_stat = sftp
            .stat(remote)
            .map_err(|e| format!("stat remote path failed: {e}"))?;
        if remote_stat.is_dir() {
            return Err(format!(
                "text editor open failed: remote path is a directory, not a file ({remote_path})"
            ));
        }
        let total_bytes = remote_stat.size.unwrap_or(0);
        if total_bytes > EDITOR_MAX_BYTES {
            return Ok(SftpTextReadResult {
                content: String::new(),
                total_bytes,
                loaded_bytes: 0,
                truncated: false,
                too_large: true,
            });
        }

        let mut source = sftp
            .open(remote)
            .map_err(|e| format!("open remote file failed: {e}"))?;
        let mut bytes = Vec::new();
        Read::by_ref(&mut source)
            .take(EDITOR_READ_CHUNK_BYTES)
            .read_to_end(&mut bytes)
            .map_err(|e| format!("read remote file failed: {e}"))?;
        if bytes.contains(&0) {
            return Err("target file is not recognized as text (binary data detected)".to_string());
        }
        let content = std::str::from_utf8(&bytes)
            .map_err(|_| "target file is not recognized as UTF-8 text".to_string())?
            .to_string();
        let loaded_bytes = bytes.len() as u64;
        let truncated = total_bytes > loaded_bytes;
        Ok(SftpTextReadResult {
            content,
            total_bytes,
            loaded_bytes,
            truncated,
            too_large: false,
        })
    }

    pub async fn save_sftp_text_file(
        &self,
        id: Uuid,
        remote_path: String,
        content: String,
    ) -> Result<(), String> {
        let session = self.find_session(id).await?;
        if !matches!(session.protocol, Protocol::Ssh) {
            return Err("text editor only supports ssh sessions".to_string());
        }
        if content.len() as u64 > EDITOR_MAX_BYTES {
            return Err(format!(
                "save blocked: file content exceeds {} bytes editor limit",
                EDITOR_MAX_BYTES
            ));
        }
        let secret = self
            .store
            .get_secret(id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "missing SSH password".to_string())?;
        let ssh = self.open_ssh_session(&session, &secret)?;
        let sftp = ssh.sftp().map_err(|e| format!("sftp init failed: {e}"))?;
        let remote = Path::new(&remote_path);
        let mut target = sftp
            .create(remote)
            .map_err(|e| format!("open remote file for write failed: {e}"))?;
        target
            .write_all(content.as_bytes())
            .map_err(|e| format!("write remote file failed: {e}"))?;
        target
            .flush()
            .map_err(|e| format!("flush remote file failed: {e}"))?;
        Ok(())
    }
}
