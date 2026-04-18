//! SFTP 列目录与下载到本机用户目录（含错误信息友好化）。

use std::fs::File;
use std::io::{copy, Write};
use std::path::{Path, PathBuf};

use base64::Engine;
use uuid::Uuid;

use crate::app::state::{AppState, SftpEntry};
use crate::domain::session::Protocol;

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
    pub async fn list_sftp_dir(
        &self,
        id: Uuid,
        path: Option<String>,
    ) -> Result<Vec<SftpEntry>, String> {
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

    pub async fn download_sftp_file(
        &self,
        id: Uuid,
        remote_path: String,
    ) -> Result<String, String> {
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
        std::fs::create_dir_all(&target_dir)
            .map_err(|e| format!("create download dir failed: {e}"))?;
        let mut target_path: PathBuf = target_dir.join(file_name);
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

    pub async fn upload_sftp_file(
        &self,
        id: Uuid,
        remote_dir: String,
        file_name: String,
        content_base64: String,
    ) -> Result<(), String> {
        let session = self.find_session(id).await?;
        if !matches!(session.protocol, Protocol::Ssh) {
            return Err("upload only supports ssh sessions".to_string());
        }
        if file_name.trim().is_empty() {
            return Err("upload failed: file name is empty".to_string());
        }

        let secret = self
            .store
            .get_secret(id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "missing SSH password".to_string())?;
        let ssh = self.open_ssh_session(&session, &secret)?;
        let sftp = ssh.sftp().map_err(|e| format!("sftp init failed: {e}"))?;

        let bytes = base64::engine::general_purpose::STANDARD
            .decode(content_base64.trim())
            .map_err(|e| format!("decode upload payload failed: {e}"))?;
        if bytes.is_empty() {
            return Err("upload failed: empty file".to_string());
        }

        let normalized_dir = if remote_dir.trim().is_empty() {
            ".".to_string()
        } else {
            remote_dir.replace('\\', "/")
        };
        let joined = if normalized_dir.ends_with('/') || normalized_dir == "/" {
            format!("{normalized_dir}{file_name}")
        } else {
            format!("{normalized_dir}/{file_name}")
        };

        let remote = Path::new(&joined);
        let mut target = sftp
            .create(remote)
            .map_err(|e| format!("open remote file for upload failed: {e}"))?;
        target
            .write_all(&bytes)
            .map_err(|e| format!("upload write failed: {e}"))?;
        target
            .flush()
            .map_err(|e| format!("upload flush failed: {e}"))?;
        Ok(())
    }
}
