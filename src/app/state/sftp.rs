use std::fs::File;
use std::io::copy;
use std::path::Path;

use uuid::Uuid;

use crate::app::state::{AppState, SftpEntry};
use crate::domain::session::Protocol;

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
        let mut output = File::create(&target_path).map_err(|e| format!("create local file failed: {e}"))?;
        copy(&mut source, &mut output).map_err(|e| format!("write local file failed: {e}"))?;
        Ok(target_path.to_string_lossy().to_string())
    }
}

