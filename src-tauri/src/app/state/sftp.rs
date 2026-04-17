use std::fs::File;
use std::io::{copy, Read, Write};
use std::path::Path;

use uuid::Uuid;

use crate::app::state::{AppState, SftpEntry};
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

fn describe_io_error(error: &std::io::Error, stage: &str, target_path: &Path) -> String {
    let raw = error.to_string();
    let target = target_path.to_string_lossy();
    if raw.eq_ignore_ascii_case("failure") {
        return format!(
            "{stage} failed: remote transfer aborted (target: {target}). Check remote file permissions, file locks, and available disk space."
        );
    }
    format!("{stage} failed: {raw} (target: {target})")
}

impl AppState {
    pub async fn list_sftp_dir(&self, id: Uuid, path: Option<String>) -> Result<Vec<SftpEntry>, String> {
        let session = self.find_session(id).await?;
        if !matches!(session.protocol, Protocol::Ssh) {
            return Err("sftp only supports ssh sessions".to_string());
        }
        let secret = self
            .store
            .get_secret(id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "missing SSH password".to_string())?;
        let ssh = self.open_ssh_session(&session, &secret)?;
        let sftp = ssh.sftp().map_err(|e| format!("sftp init failed: {e}"))?;

        let target = path.unwrap_or_else(|| ".".to_string());
        let entries = sftp
            .readdir(Path::new(&target))
            .map_err(|e| format!("sftp readdir failed: {e}"))?;
        let mut out = entries
            .into_iter()
            .filter_map(|(p, stat)| {
                let name = p.file_name()?.to_string_lossy().to_string();
                if name == "." || name == ".." {
                    return None;
                }
                let is_dir = stat.is_dir();
                let full = p.to_string_lossy().replace('\\', "/");
                Some(SftpEntry {
                    name,
                    path: full,
                    is_dir,
                    size: stat.size.unwrap_or(0),
                    mtime: stat.mtime.unwrap_or(0),
                })
            })
            .collect::<Vec<_>>();
        out.sort_by(|a, b| match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });
        Ok(out)
    }

    pub async fn download_sftp_file(&self, id: Uuid, remote_path: String) -> Result<String, String> {
        let session = self.find_session(id).await?;
        if !matches!(session.protocol, Protocol::Ssh) {
            return Err("download only supports ssh sessions".to_string());
        }
        let secret = self
            .store
            .get_secret(id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "missing SSH password".to_string())?;
        let ssh = self.open_ssh_session(&session, &secret)?;
        let sftp = ssh.sftp().map_err(|e| format!("sftp init failed: {e}"))?;

        let remote = Path::new(&remote_path);
        let file_name = remote
            .file_name()
            .and_then(|n| n.to_str())
            .filter(|n| !n.trim().is_empty())
            .ok_or_else(|| "invalid remote file name".to_string())?;
        let remote_stat = sftp
            .stat(remote)
            .map_err(|e| format!("stat remote path failed: {e}"))?;
        if remote_stat.is_dir() {
            return Err(format!(
                "download failed: remote path is a directory, not a file ({remote_path})"
            ));
        }
        let mut source = sftp
            .open(remote)
            .map_err(|e| format!("open remote file failed: {e}"))?;

        let mut target_dir =
            dirs::download_dir().unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
        target_dir.push("rshell");
        std::fs::create_dir_all(&target_dir).map_err(|e| format!("create download dir failed: {e}"))?;
        let mut target_path = target_dir.join(file_name);
        let mut idx = 1;
        while target_path.exists() {
            let stem = Path::new(file_name)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("file");
            let ext = Path::new(file_name).extension().and_then(|e| e.to_str());
            let candidate = match ext {
                Some(ext) => format!("{stem} ({idx}).{ext}"),
                None => format!("{stem} ({idx})"),
            };
            target_path = target_dir.join(candidate);
            idx += 1;
        }
        let mut output = File::create(&target_path)
            .map_err(|e| describe_io_error(&e, "create local file", &target_path))?;
        copy(&mut source, &mut output)
            .map_err(|e| describe_io_error(&e, "write local file", &target_path))?;
        Ok(target_path.to_string_lossy().to_string())
    }

    pub async fn read_sftp_text_file(&self, id: Uuid, remote_path: String) -> Result<SftpTextReadResult, String> {
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

    pub async fn save_sftp_text_file(&self, id: Uuid, remote_path: String, content: String) -> Result<(), String> {
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

