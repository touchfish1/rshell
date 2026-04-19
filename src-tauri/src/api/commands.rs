//! Tauri 命令入口聚合：每个 `#[tauri::command]` 在此声明，实现分散在子模块。
//!
//! - `sessions`：会话 CRUD、密钥读写
//! - `terminal`：连接、终端 I/O、断开
//! - `sftp`：目录列表、下载、文本读写
//! - `metrics` / `system`：主机指标与系统打开目录、外链
//! - `test_host_reachability`：ICMP ping 与 TCP/协议横幅任一成功即为在线（禁 ping 时仍可通过端口探测）

mod command_sanitize;
mod common;
mod metrics;
mod sessions;
mod sftp;
mod system;
mod terminal;

use tauri::{AppHandle, State};

use crate::app::{AppState, AuditRecord, HostMetrics, SftpEntry, SftpTextReadResult};
use crate::domain::session::{Session, SessionInput};
use tokio::io::AsyncReadExt;
use tokio::net::TcpStream;
use tokio::process::Command as TokioCommand;
use tokio::time::{timeout, Duration, Instant};

/// Windows 上避免 `ping` 等子进程弹出控制台黑窗（`CREATE_NO_WINDOW`）。
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[tauri::command]
pub async fn list_sessions(state: State<'_, AppState>) -> Result<Vec<Session>, String> {
    sessions::list_sessions(state).await
}

#[tauri::command]
pub async fn create_session(
    state: State<'_, AppState>,
    input: SessionInput,
    secret: Option<String>,
) -> Result<Session, String> {
    sessions::create_session(state, input, secret).await
}

#[tauri::command]
pub async fn update_session(
    state: State<'_, AppState>,
    id: String,
    input: SessionInput,
    secret: Option<String>,
) -> Result<Session, String> {
    sessions::update_session(state, id, input, secret).await
}

#[tauri::command]
pub async fn delete_session(state: State<'_, AppState>, id: String) -> Result<(), String> {
    sessions::delete_session(state, id).await
}

#[tauri::command]
pub async fn has_session_secret(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    sessions::has_session_secret(state, id).await
}

#[tauri::command]
pub async fn get_session_secret(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<String>, String> {
    sessions::get_session_secret(state, id).await
}

#[tauri::command]
pub async fn connect_session(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    secret: Option<String>,
) -> Result<(), String> {
    terminal::connect_session(app, state, id, secret).await
}

#[tauri::command]
pub async fn pull_output(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<String>, String> {
    terminal::pull_output(app, state, id).await
}

#[tauri::command]
pub async fn disconnect_session(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    terminal::disconnect_session(app, state, id).await
}

#[tauri::command]
pub async fn send_input(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    input: String,
) -> Result<(), String> {
    terminal::send_input(app, state, id, input).await
}

#[tauri::command]
pub async fn resize_terminal(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    terminal::resize_terminal(app, state, id, cols, rows).await
}

#[tauri::command]
pub async fn list_sftp_dir(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    path: Option<String>,
) -> Result<Vec<SftpEntry>, String> {
    sftp::list_sftp_dir(app, state, id, path).await
}

#[tauri::command]
pub async fn download_sftp_file(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    remote_path: String,
) -> Result<String, String> {
    sftp::download_sftp_file(app, state, id, remote_path).await
}

#[tauri::command]
pub async fn read_sftp_text_file(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    remote_path: String,
) -> Result<SftpTextReadResult, String> {
    sftp::read_sftp_text_file(app, state, id, remote_path).await
}

#[tauri::command]
pub async fn save_sftp_text_file(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    remote_path: String,
    content: String,
) -> Result<(), String> {
    sftp::save_sftp_text_file(app, state, id, remote_path, content).await
}

#[tauri::command]
pub async fn upload_sftp_file(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    remote_dir: String,
    file_name: String,
    content_base64: String,
) -> Result<(), String> {
    sftp::upload_sftp_file(app, state, id, remote_dir, file_name, content_base64).await
}

#[tauri::command]
pub async fn open_in_file_manager(path: String) -> Result<(), String> {
    system::open_in_file_manager(path).await
}

#[tauri::command]
pub async fn open_external_url(url: String) -> Result<(), String> {
    system::open_external_url(url).await
}

#[tauri::command]
pub async fn get_host_metrics(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<HostMetrics, String> {
    metrics::get_host_metrics(app, state, id).await
}

/// SSH：在 TCP 已建立后读取协议横幅，必须以 `SSH-` 开头（可分片到达），避免仅端口开放就判为在线。
async fn verify_ssh_banner(stream: &mut TcpStream) -> bool {
    let mut acc: Vec<u8> = Vec::with_capacity(64);
    let mut buf = [0u8; 128];
    let deadline = Instant::now() + Duration::from_millis(4000);

    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return false;
        }
        match timeout(remaining, stream.read(&mut buf)).await {
            Ok(Ok(0)) => return false,
            Ok(Ok(n)) => {
                acc.extend_from_slice(&buf[..n]);
                if acc.len() >= 4 && acc[..4].eq_ignore_ascii_case(b"SSH-") {
                    return true;
                }
                if acc.len() > 512 {
                    return false;
                }
            }
            Ok(Err(_)) => return false,
            Err(_) => return false,
        }
    }
}

async fn verify_stream_after_tcp(mut stream: TcpStream, protocol: Option<&str>) -> bool {
    let proto = protocol.map(str::trim).filter(|s| !s.is_empty());

    match proto {
        Some(p) if p.eq_ignore_ascii_case("telnet") => true,
        Some(p) if p.eq_ignore_ascii_case("ssh") => verify_ssh_banner(&mut stream).await,
        Some(_) => verify_ssh_banner(&mut stream).await,
        None => verify_ssh_banner(&mut stream).await,
    }
}

/// 系统 ICMP ping（与 `ping` 命令一致）。失败时返回 `false`（含不可达、超时、命令不存在）。
async fn icmp_ping_host(host: &str) -> bool {
    let host = host.trim();
    if host.is_empty() {
        return false;
    }

    #[cfg(windows)]
    {
        return TokioCommand::new("ping")
            .creation_flags(CREATE_NO_WINDOW)
            .args(["-n", "1", "-w", "3000", host])
            .output()
            .await
            .map(|o| o.status.success())
            .unwrap_or(false);
    }

    #[cfg(target_os = "linux")]
    {
        return TokioCommand::new("ping")
            .args(["-c", "1", "-W", "3", host])
            .output()
            .await
            .map(|o| o.status.success())
            .unwrap_or(false);
    }

    #[cfg(target_os = "macos")]
    {
        return TokioCommand::new("ping")
            .args(["-c", "1", "-W", "3000", host])
            .output()
            .await
            .map(|o| o.status.success())
            .unwrap_or(false);
    }

    #[cfg(all(
        not(windows),
        not(target_os = "linux"),
        not(target_os = "macos")
    ))]
    {
        return TokioCommand::new("ping")
            .args(["-c", "1", host])
            .output()
            .await
            .map(|o| o.status.success())
            .unwrap_or(false);
    }
}

async fn tcp_service_reachable(host: &str, port: u16, duration: Duration, protocol: Option<&str>) -> bool {
    let addr = format!("{host}:{port}");
    let result = timeout(duration, TcpStream::connect(addr)).await;
    let stream = match result {
        Ok(Ok(s)) => s,
        _ => return false,
    };
    verify_stream_after_tcp(stream, protocol).await
}

#[tauri::command]
pub async fn test_host_reachability(
    host: String,
    port: u16,
    timeout_ms: Option<u64>,
    protocol: Option<String>,
) -> Result<bool, String> {
    let host_trim = host.trim();
    if host_trim.is_empty() {
        return Err("host is required".to_string());
    }
    let duration = Duration::from_millis(timeout_ms.unwrap_or(2000).clamp(100, 10000));

    let (icmp_ok, svc_ok) = tokio::join!(
        icmp_ping_host(host_trim),
        tcp_service_reachable(host_trim, port, duration, protocol.as_deref())
    );
    Ok(icmp_ok || svc_ok)
}

#[tauri::command]
pub async fn list_audits(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<AuditRecord>, String> {
    state.list_audits(limit).await
}
