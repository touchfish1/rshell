use serde::Serialize;
use tokio::io::AsyncReadExt;
use tokio::net::TcpStream;
use tokio::process::Command as TokioCommand;
use tokio::time::{timeout, Duration, Instant};

/// Windows 上避免 `ping` 等子进程弹出控制台黑窗（`CREATE_NO_WINDOW`）。
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

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

async fn icmp_ping_host_timed(host: &str) -> (bool, Option<Duration>) {
    let t0 = Instant::now();
    let ok = icmp_ping_host(host).await;
    if ok {
        (true, Some(t0.elapsed()))
    } else {
        (false, None)
    }
}

async fn tcp_service_reachable_timed(
    host: &str,
    port: u16,
    duration: Duration,
    protocol: Option<&str>,
) -> (bool, Option<Duration>) {
    let t0 = Instant::now();
    let ok = tcp_service_reachable(host, port, duration, protocol).await;
    if ok {
        (true, Some(t0.elapsed()))
    } else {
        (false, None)
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct HostReachability {
    pub online: bool,
    pub latency_ms: Option<u64>,
}

pub async fn test_host_reachability(
    host: String,
    port: u16,
    timeout_ms: Option<u64>,
    protocol: Option<String>,
) -> Result<HostReachability, String> {
    let host_trim = host.trim();
    if host_trim.is_empty() {
        return Err("host is required".to_string());
    }
    let duration = Duration::from_millis(timeout_ms.unwrap_or(2000).clamp(100, 10000));

    let ((icmp_ok, icmp_lat), (tcp_ok, tcp_lat)) = tokio::join!(
        icmp_ping_host_timed(host_trim),
        tcp_service_reachable_timed(host_trim, port, duration, protocol.as_deref())
    );
    let online = icmp_ok || tcp_ok;
    let latency_ms = if !online {
        None
    } else {
        let mut ms: Vec<u64> = Vec::new();
        if icmp_ok {
            if let Some(d) = icmp_lat {
                ms.push(d.as_millis() as u64);
            }
        }
        if tcp_ok {
            if let Some(d) = tcp_lat {
                ms.push(d.as_millis() as u64);
            }
        }
        ms.into_iter().min()
    };

    Ok(HostReachability { online, latency_ms })
}

