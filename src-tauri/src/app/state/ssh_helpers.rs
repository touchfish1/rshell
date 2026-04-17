use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

use ssh2::Session as Ssh2Session;

use crate::app::state::AppState;
use crate::domain::session::Session;

impl AppState {
    pub(super) fn open_ssh_session(&self, session: &Session, secret: &str) -> Result<Ssh2Session, String> {
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

    pub(super) fn run_ssh_command(ssh: &Ssh2Session, command: &str) -> Result<String, String> {
        use std::io::Read;

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
}

