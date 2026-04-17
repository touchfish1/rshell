use std::collections::HashMap;
use std::fs::File;
use std::io::{copy, Read};
use std::net::{SocketAddr, TcpStream};
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use ssh2::Session as Ssh2Session;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::domain::session::{Protocol, Session, SessionInput};
use crate::domain::terminal::{TerminalClient, TerminalError};
use crate::infra::ssh_client::SshClient;
use crate::infra::store::{SessionStore, StoreError};
use crate::infra::telnet_client::TelnetClient;

pub struct ActiveTerminal {
    pub client: Mutex<Box<dyn TerminalClient>>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SftpEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub mtime: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct HostMetrics {
    pub cpu_percent: f64,
    pub memory_used_bytes: u64,
    pub memory_total_bytes: u64,
    pub memory_percent: f64,
    pub disk_used_bytes: u64,
    pub disk_total_bytes: u64,
    pub disk_percent: f64,
}

pub struct AppState {
    store: SessionStore,
    sessions: Arc<Mutex<Vec<Session>>>,
    active: Arc<Mutex<HashMap<Uuid, Arc<ActiveTerminal>>>>,
}

impl Default for AppState {
    fn default() -> Self {
        let store = SessionStore::new().expect("failed to init session store");
        let sessions = store.list().unwrap_or_default();
        Self {
            store,
            sessions: Arc::new(Mutex::new(sessions)),
            active: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl AppState {
    fn open_ssh_session(&self, session: &Session, secret: &str) -> Result<Ssh2Session, String> {
        let addr = format!("{}:{}", session.host, session.port);
        let socket_addr: SocketAddr = addr.parse().map_err(|e| format!("invalid address: {e}"))?;
        let mut last_error = String::new();
        let max_attempts = 3_u8;

        for attempt in 1..=max_attempts {
            let attempt_result = (|| -> Result<Ssh2Session, String> {
                let tcp = TcpStream::connect_timeout(&socket_addr, Duration::from_secs(8))
                    .map_err(|e| format!("connect failed: {e}"))?;
                let _ = tcp.set_read_timeout(Some(Duration::from_secs(10)));
                let _ = tcp.set_write_timeout(Some(Duration::from_secs(10)));
                let _ = tcp.set_nodelay(true);

                let mut ssh = Ssh2Session::new().map_err(|e| format!("session init failed: {e}"))?;
                ssh.set_timeout(10_000);
                ssh.set_tcp_stream(tcp);
                ssh.handshake().map_err(|e| format!("handshake failed: {e}"))?;
                ssh.userauth_password(&session.username, secret)
                    .map_err(|e| format!("auth failed: {e}"))?;
                Ok(ssh)
            })();

            match attempt_result {
                Ok(ssh) => return Ok(ssh),
                Err(err) => {
                    last_error = err;
                    if attempt < max_attempts {
                        std::thread::sleep(Duration::from_millis(250 * u64::from(attempt)));
                    }
                }
            }
        }

        Err(format!(
            "SSH 建连失败，已重试 {max_attempts} 次: {last_error}"
        ))
    }

    fn run_ssh_command(ssh: &Ssh2Session, command: &str) -> Result<String, String> {
        let mut channel = ssh
            .channel_session()
            .map_err(|e| format!("open channel failed: {e}"))?;
        channel.exec(command).map_err(|e| format!("exec failed: {e}"))?;
        let mut out = String::new();
        channel
            .read_to_string(&mut out)
            .map_err(|e| format!("read output failed: {e}"))?;
        channel.wait_close().map_err(|e| format!("wait close failed: {e}"))?;
        Ok(out)
    }

    pub async fn list_sessions(&self) -> Vec<Session> {
        self.sessions.lock().await.clone()
    }

    pub async fn create_session(&self, input: SessionInput, secret: Option<String>) -> Result<Session, String> {
        let session = input.into_session();
        {
            let mut sessions = self.sessions.lock().await;
            sessions.push(session.clone());
            self.store
                .save_all(&sessions)
                .map_err(|e| e.to_string())?;
        }
        if let Some(secret) = secret {
            self.store
                .set_secret(session.id, &secret)
                .map_err(|e| e.to_string())?;
        }
        Ok(session)
    }

    pub async fn update_session(&self, id: Uuid, input: SessionInput, secret: Option<String>) -> Result<Session, String> {
        let mut sessions = self.sessions.lock().await;
        let target_index = sessions
            .iter()
            .position(|s| s.id == id)
            .ok_or_else(|| "session not found".to_string())?;
        let target = &mut sessions[target_index];
        target.name = input.name;
        target.protocol = input.protocol;
        target.host = input.host;
        target.port = input.port;
        target.username = input.username;
        target.encoding = input.encoding.unwrap_or_else(|| "utf-8".to_string());
        target.keepalive_secs = input.keepalive_secs.unwrap_or(30);
        let updated = target.clone();
        self.store.save_all(&sessions).map_err(|e| e.to_string())?;
        if let Some(secret) = secret {
            self.store.set_secret(id, &secret).map_err(|e| e.to_string())?;
        }
        Ok(updated)
    }

    pub async fn delete_session(&self, id: Uuid) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        sessions.retain(|s| s.id != id);
        self.store.save_all(&sessions).map_err(|e| e.to_string())?;
        self.store.delete_secret(id).map_err(|e| e.to_string())?;
        self.active.lock().await.remove(&id);
        Ok(())
    }

    pub async fn connect_session(&self, id: Uuid, secret_override: Option<String>) -> Result<(), String> {
        let session = self
            .sessions
            .lock()
            .await
            .iter()
            .find(|s| s.id == id)
            .cloned()
            .ok_or_else(|| "session not found".to_string())?;
        let secret = if secret_override.is_some() {
            secret_override
        } else {
            self.store.get_secret(id).map_err(|e| e.to_string())?
        };

        let mut client: Box<dyn TerminalClient> = match session.protocol {
            Protocol::Ssh => Box::new(SshClient::new(secret)),
            Protocol::Telnet => Box::new(TelnetClient::new()),
        };
        client.connect(&session).await.map_err(|e| e.to_string())?;

        self.active.lock().await.insert(
            id,
            Arc::new(ActiveTerminal {
                client: Mutex::new(client),
            }),
        );
        Ok(())
    }

    pub async fn has_secret(&self, id: Uuid) -> Result<bool, String> {
        let secret = self.store.get_secret(id).map_err(|e| e.to_string())?;
        Ok(secret.is_some() && !secret.unwrap_or_default().is_empty())
    }

    pub async fn get_secret(&self, id: Uuid) -> Result<Option<String>, String> {
        self.store.get_secret(id).map_err(|e| e.to_string())
    }

    pub async fn disconnect_session(&self, id: Uuid) -> Result<(), String> {
        let terminal = {
            let mut active = self.active.lock().await;
            active.remove(&id)
        };
        if let Some(term) = terminal {
            term.client
                .lock()
                .await
                .disconnect()
                .await
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub async fn send_input(&self, id: Uuid, text: String) -> Result<(), String> {
        let term = {
            let active = self.active.lock().await;
            active.get(&id).cloned().ok_or_else(|| "inactive session".to_string())?
        };
        let result = term
            .client
            .lock()
            .await
            .write(text.as_bytes())
            .await
            .map_err(|e| e.to_string());
        result
    }

    pub async fn resize_terminal(&self, id: Uuid, cols: u16, rows: u16) -> Result<(), String> {
        let term = {
            let active = self.active.lock().await;
            active.get(&id).cloned().ok_or_else(|| "inactive session".to_string())?
        };
        let result = term
            .client
            .lock()
            .await
            .resize(cols, rows)
            .await
            .map_err(|e| e.to_string());
        result
    }

    pub async fn poll_output(&self, id: Uuid) -> Result<Vec<u8>, String> {
        let term = {
            let active = self.active.lock().await;
            active.get(&id).cloned().ok_or_else(|| "inactive session".to_string())?
        };
        let result = term
            .client
            .lock()
            .await
            .read()
            .await
            .map_err(|e| e.to_string());
        result
    }

    pub async fn list_sftp_dir(&self, id: Uuid, path: Option<String>) -> Result<Vec<SftpEntry>, String> {
        let session = self
            .sessions
            .lock()
            .await
            .iter()
            .find(|s| s.id == id)
            .cloned()
            .ok_or_else(|| "session not found".to_string())?;
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
        let session = self
            .sessions
            .lock()
            .await
            .iter()
            .find(|s| s.id == id)
            .cloned()
            .ok_or_else(|| "session not found".to_string())?;
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

    pub async fn get_host_metrics(&self, id: Uuid) -> Result<HostMetrics, String> {
        let session = self
            .sessions
            .lock()
            .await
            .iter()
            .find(|s| s.id == id)
            .cloned()
            .ok_or_else(|| "session not found".to_string())?;
        if !matches!(session.protocol, Protocol::Ssh) {
            return Err("host metrics only supports ssh sessions".to_string());
        }
        let secret = self
            .store
            .get_secret(id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "missing SSH password".to_string())?;
        let ssh = self.open_ssh_session(&session, &secret)?;

        let cpu_raw = Self::run_ssh_command(
            &ssh,
            "sh -lc \"grep '^cpu ' /proc/stat; sleep 0.2; grep '^cpu ' /proc/stat\"",
        )?;
        let cpu_lines = cpu_raw.lines().collect::<Vec<_>>();
        let parse_cpu = |line: &str| -> Option<(u64, u64)> {
            let mut parts = line.split_whitespace();
            if parts.next()? != "cpu" {
                return None;
            }
            let values = parts
                .filter_map(|v| v.parse::<u64>().ok())
                .collect::<Vec<_>>();
            if values.len() < 4 {
                return None;
            }
            let total = values.iter().sum::<u64>();
            let idle = values.get(3).copied().unwrap_or(0) + values.get(4).copied().unwrap_or(0);
            Some((total, idle))
        };
        let (cpu_total_1, cpu_idle_1) = parse_cpu(cpu_lines.first().copied().unwrap_or("")).unwrap_or((0, 0));
        let (cpu_total_2, cpu_idle_2) = parse_cpu(cpu_lines.get(1).copied().unwrap_or("")).unwrap_or((0, 0));
        let cpu_delta = cpu_total_2.saturating_sub(cpu_total_1) as f64;
        let cpu_idle_delta = cpu_idle_2.saturating_sub(cpu_idle_1) as f64;
        let cpu_percent = if cpu_delta > 0.0 {
            ((cpu_delta - cpu_idle_delta) * 100.0 / cpu_delta).clamp(0.0, 100.0)
        } else {
            0.0
        };

        let mem_raw = Self::run_ssh_command(&ssh, "cat /proc/meminfo")?;
        let mut mem_total_kb = 0_u64;
        let mut mem_available_kb = 0_u64;
        for line in mem_raw.lines() {
            if let Some(v) = line.strip_prefix("MemTotal:") {
                mem_total_kb = v
                    .split_whitespace()
                    .next()
                    .and_then(|x| x.parse::<u64>().ok())
                    .unwrap_or(0);
            } else if let Some(v) = line.strip_prefix("MemAvailable:") {
                mem_available_kb = v
                    .split_whitespace()
                    .next()
                    .and_then(|x| x.parse::<u64>().ok())
                    .unwrap_or(0);
            }
        }
        let memory_total_bytes = mem_total_kb.saturating_mul(1024);
        let memory_used_bytes = mem_total_kb.saturating_sub(mem_available_kb).saturating_mul(1024);
        let memory_percent = if memory_total_bytes > 0 {
            (memory_used_bytes as f64 * 100.0 / memory_total_bytes as f64).clamp(0.0, 100.0)
        } else {
            0.0
        };

        let disk_raw = Self::run_ssh_command(&ssh, "df -B1 /")?;
        let disk_line = disk_raw
            .lines()
            .nth(1)
            .ok_or_else(|| "parse disk metrics failed".to_string())?;
        let fields = disk_line.split_whitespace().collect::<Vec<_>>();
        if fields.len() < 5 {
            return Err("parse disk metrics failed".to_string());
        }
        let disk_total_bytes = fields.get(1).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
        let disk_used_bytes = fields.get(2).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
        let disk_percent = if disk_total_bytes > 0 {
            (disk_used_bytes as f64 * 100.0 / disk_total_bytes as f64).clamp(0.0, 100.0)
        } else {
            0.0
        };

        Ok(HostMetrics {
            cpu_percent,
            memory_used_bytes,
            memory_total_bytes,
            memory_percent,
            disk_used_bytes,
            disk_total_bytes,
            disk_percent,
        })
    }
}

impl From<TerminalError> for String {
    fn from(value: TerminalError) -> Self {
        value.to_string()
    }
}

impl From<StoreError> for String {
    fn from(value: StoreError) -> Self {
        value.to_string()
    }
}

#[cfg(test)]
mod tests {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    use crate::domain::session::{Protocol, SessionInput};

    use super::AppState;

    async fn spawn_echo_server() -> u16 {
        let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind echo server");
        let port = listener.local_addr().expect("read local addr").port();
        tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.expect("accept client");
            let mut buf = [0_u8; 1024];
            let n = socket.read(&mut buf).await.expect("read payload");
            socket.write_all(&buf[..n]).await.expect("echo payload");
        });
        port
    }

    async fn assert_session_roundtrip(protocol: Protocol, port: u16, payload: &str) {
        let state = AppState::default();
        let session = state
            .create_session(
                SessionInput {
                    name: format!("{protocol:?}-test"),
                    protocol,
                    host: "127.0.0.1".to_string(),
                    port,
                    username: "tester".to_string(),
                    encoding: Some("utf-8".to_string()),
                    keepalive_secs: Some(30),
                },
                None,
            )
            .await
            .expect("create session");

        state
            .connect_session(session.id, None)
            .await
            .expect("connect session");
        state
            .send_input(session.id, payload.to_string())
            .await
            .expect("send payload");
        let output = state.poll_output(session.id).await.expect("poll output");
        assert_eq!(String::from_utf8_lossy(&output), payload);
        state
            .disconnect_session(session.id)
            .await
            .expect("disconnect session");
        state
            .delete_session(session.id)
            .await
            .expect("cleanup session");
    }

    #[tokio::test]
    async fn telnet_session_create_and_io_roundtrip() {
        let port = spawn_echo_server().await;
        assert_session_roundtrip(Protocol::Telnet, port, "telnet-ping").await;
    }

    #[tokio::test]
    async fn ssh_session_without_secret_fails() {
        let state = AppState::default();
        let session = state
            .create_session(
                SessionInput {
                    name: "ssh-test".to_string(),
                    protocol: Protocol::Ssh,
                    host: "127.0.0.1".to_string(),
                    port: 22,
                    username: "tester".to_string(),
                    encoding: Some("utf-8".to_string()),
                    keepalive_secs: Some(30),
                },
                None,
            )
            .await
            .expect("create session");

        let err = state
            .connect_session(session.id, None)
            .await
            .expect_err("connect should fail without secret");
        assert!(err.contains("missing SSH password"));
        state
            .delete_session(session.id)
            .await
            .expect("cleanup session");
    }
}
