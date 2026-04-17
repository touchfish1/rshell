use async_trait::async_trait;
use ssh2::Session as Ssh2Session;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::sync::mpsc as std_mpsc;
use std::thread;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::timeout;

use crate::domain::session::Session;
use crate::domain::terminal::{TerminalClient, TerminalError};

enum WorkerCommand {
    Write(Vec<u8>),
    Resize(u16, u16),
    Disconnect,
}

pub struct SshClient {
    password: Option<String>,
    cmd_tx: Option<std_mpsc::Sender<WorkerCommand>>,
    output_rx: Option<mpsc::UnboundedReceiver<Vec<u8>>>,
    host: Option<String>,
    port: Option<u16>,
    username: Option<String>,
}

impl SshClient {
    pub fn new(password: Option<String>) -> Self {
        Self {
            password,
            cmd_tx: None,
            output_rx: None,
            host: None,
            port: None,
            username: None,
        }
    }

    fn start_worker(
        host: String,
        port: u16,
        username: String,
        password: String,
    ) -> Result<(std_mpsc::Sender<WorkerCommand>, mpsc::UnboundedReceiver<Vec<u8>>), TerminalError> {
        let (cmd_tx, cmd_rx) = std_mpsc::channel::<WorkerCommand>();
        let (output_tx, output_rx) = mpsc::unbounded_channel::<Vec<u8>>();
        let (init_tx, init_rx) = std_mpsc::channel::<Result<(), String>>();

        thread::spawn(move || {
            let open_shell_channel =
                |ssh: &Ssh2Session, output_tx: &mpsc::UnboundedSender<Vec<u8>>| -> Option<ssh2::Channel> {
                    let mut channel = match ssh.channel_session() {
                        Ok(c) => c,
                        Err(e) => {
                            let _ = output_tx.send(
                                format!("\r\n[ssh] open channel failed: {e}\r\n").into_bytes(),
                            );
                            return None;
                        }
                    };
                    if let Err(e) = channel.request_pty("xterm", None, Some((120, 40, 0, 0))) {
                        let _ = output_tx.send(
                            format!("\r\n[ssh] request pty failed: {e}\r\n").into_bytes(),
                        );
                        return None;
                    }
                    if let Err(e) = channel.shell() {
                        let _ = output_tx.send(
                            format!("\r\n[ssh] request shell failed: {e}\r\n").into_bytes(),
                        );
                        return None;
                    }
                    Some(channel)
                };

            let addr = format!("{host}:{port}");
            let socket_addr: SocketAddr = match addr.parse() {
                Ok(a) => a,
                Err(e) => {
                    let _ = init_tx.send(Err(format!("invalid address: {e}")));
                    let _ = output_tx.send(format!("\r\n[ssh] invalid address: {e}\r\n").into_bytes());
                    return;
                }
            };

            let tcp = match TcpStream::connect_timeout(&socket_addr, Duration::from_secs(8)) {
                Ok(stream) => stream,
                Err(e) => {
                    let _ = init_tx.send(Err(format!("connect failed: {e}")));
                    let _ = output_tx.send(format!("\r\n[ssh] connect failed: {e}\r\n").into_bytes());
                    return;
                }
            };
            // Do not set aggressive socket timeouts here.
            // Very short TCP timeouts cause intermittent libssh2 transport read failures.

            let mut ssh = match Ssh2Session::new() {
                Ok(s) => s,
                Err(e) => {
                    let _ = init_tx.send(Err(format!("session init failed: {e}")));
                    let _ = output_tx.send(format!("\r\n[ssh] session init failed: {e}\r\n").into_bytes());
                    return;
                }
            };
            ssh.set_tcp_stream(tcp);
            if let Err(e) = ssh.handshake() {
                let _ = init_tx.send(Err(format!("handshake failed: {e}")));
                let _ = output_tx.send(format!("\r\n[ssh] handshake failed: {e}\r\n").into_bytes());
                return;
            }
            if let Err(e) = ssh.userauth_password(&username, &password) {
                let _ = init_tx.send(Err(format!("auth failed: {e}")));
                let _ = output_tx.send(format!("\r\n[ssh] auth failed: {e}\r\n").into_bytes());
                return;
            }

            let mut channel = match open_shell_channel(&ssh, &output_tx) {
                Some(ch) => ch,
                None => {
                    let _ = init_tx.send(Err("open shell channel failed".to_string()));
                    return;
                }
            };

            // Non-blocking mode avoids long read stalls that delay interactive input echo.
            ssh.set_blocking(false);
            let _ = init_tx.send(Ok(()));
            let _ = output_tx.send(b"\r\n[ssh] connected\r\n".to_vec());

            let mut buf = [0_u8; 8192];
            loop {
                while let Ok(cmd) = cmd_rx.try_recv() {
                    match cmd {
                        WorkerCommand::Write(data) => {
                            let normalized = data
                                .into_iter()
                                .map(|b| if b == b'\r' { b'\n' } else { b })
                                .collect::<Vec<u8>>();
                            if let Err(e) = channel.write_all(&normalized) {
                                let text = e.to_string();
                                if text.contains("closed channel") || text.contains("channel is closed") {
                                    if let Some(new_channel) = open_shell_channel(&ssh, &output_tx) {
                                        channel = new_channel;
                                        let _ = output_tx.send(b"\r\n[ssh] channel reopened\r\n".to_vec());
                                        let _ = channel.write_all(&normalized);
                                    } else {
                                        let _ = output_tx.send(b"\r\n[ssh] reopen failed\r\n".to_vec());
                                        return;
                                    }
                                }
                                let _ = output_tx
                                    .send(format!("\r\n[ssh] write failed: {e}\r\n").into_bytes());
                            }
                            let _ = channel.flush();
                        }
                        WorkerCommand::Resize(cols, rows) => {
                            let _ = channel.request_pty_size(cols as u32, rows as u32, None, None);
                        }
                        WorkerCommand::Disconnect => {
                            let _ = channel.close();
                            let _ = channel.wait_close();
                            return;
                        }
                    }
                }

                match channel.read(&mut buf) {
                    Ok(n) if n > 0 => {
                        let _ = output_tx.send(buf[..n].to_vec());
                    }
                    Ok(_) => {
                        if channel.eof() {
                            let _ = output_tx.send(b"\r\n[ssh] remote closed, reopen\r\n".to_vec());
                            let _ = channel.close();
                            let _ = channel.wait_close();
                            if let Some(new_channel) = open_shell_channel(&ssh, &output_tx) {
                                channel = new_channel;
                                let _ = output_tx.send(b"\r\n[ssh] channel reopened\r\n".to_vec());
                            } else {
                                return;
                            }
                        }
                    }
                    Err(e) => {
                        if e.kind() != std::io::ErrorKind::WouldBlock
                            && e.kind() != std::io::ErrorKind::TimedOut
                            && e.kind() != std::io::ErrorKind::Interrupted
                        {
                            let _ = output_tx.send(
                                format!("\r\n[ssh] read failed: {e}\r\n").into_bytes(),
                            );
                            let text = e.to_string();
                            if text.contains("transport read") {
                                // Transient network jitter can surface as transport read.
                                // Keep worker alive and continue polling instead of hard exit.
                                thread::sleep(Duration::from_millis(50));
                                continue;
                            }
                            if text.contains("closed channel") || text.contains("channel is closed") {
                                if let Some(new_channel) = open_shell_channel(&ssh, &output_tx) {
                                    channel = new_channel;
                                    let _ = output_tx.send(b"\r\n[ssh] channel reopened\r\n".to_vec());
                                    continue;
                                }
                            }
                            return;
                        }
                    }
                }

                thread::sleep(Duration::from_millis(1));
            }
        });

        match init_rx.recv_timeout(Duration::from_secs(10)) {
            Ok(Ok(())) => Ok((cmd_tx, output_rx)),
            Ok(Err(e)) => Err(TerminalError::Connection(e)),
            Err(_) => Err(TerminalError::Connection(
                "ssh worker init timeout".to_string(),
            )),
        }
    }

    fn reconnect_worker(&mut self) -> Result<(), TerminalError> {
        let host = self
            .host
            .clone()
            .ok_or_else(|| TerminalError::Connection("missing host".to_string()))?;
        let port = self
            .port
            .ok_or_else(|| TerminalError::Connection("missing port".to_string()))?;
        let username = self
            .username
            .clone()
            .ok_or_else(|| TerminalError::Connection("missing username".to_string()))?;
        let password = self
            .password
            .clone()
            .ok_or_else(|| TerminalError::Connection("missing SSH password".to_string()))?;

        let (cmd_tx, output_rx) = Self::start_worker(host, port, username, password)?;
        self.cmd_tx = Some(cmd_tx);
        self.output_rx = Some(output_rx);
        Ok(())
    }
}

#[async_trait]
impl TerminalClient for SshClient {
    async fn connect(&mut self, session: &Session) -> Result<(), TerminalError> {
        let password = self
            .password
            .clone()
            .ok_or_else(|| TerminalError::Connection("missing SSH password".to_string()))?;

        self.host = Some(session.host.clone());
        self.port = Some(session.port);
        self.username = Some(session.username.clone());

        let (cmd_tx, output_rx) =
            Self::start_worker(session.host.clone(), session.port, session.username.clone(), password)?;
        self.cmd_tx = Some(cmd_tx);
        self.output_rx = Some(output_rx);
        Ok(())
    }

    async fn read(&mut self) -> Result<Vec<u8>, TerminalError> {
        let Some(rx) = self.output_rx.as_mut() else {
            return Ok(vec![]);
        };
        let mut merged: Vec<u8> = Vec::new();
        for _ in 0..32 {
            match rx.try_recv() {
                Ok(chunk) => merged.extend_from_slice(&chunk),
                Err(_) => break,
            }
        }
        if merged.is_empty() {
            match timeout(Duration::from_millis(2), rx.recv()).await {
                Ok(Some(data)) => Ok(data),
                _ => Ok(vec![]),
            }
        } else {
            Ok(merged)
        }
    }

    async fn write(&mut self, data: &[u8]) -> Result<(), TerminalError> {
        let Some(tx) = self.cmd_tx.as_ref() else {
            return Err(TerminalError::SessionNotFound);
        };
        match tx.send(WorkerCommand::Write(data.to_vec())) {
            Ok(()) => Ok(()),
            Err(_) => {
                self.reconnect_worker()?;
                let Some(new_tx) = self.cmd_tx.as_ref() else {
                    return Err(TerminalError::SessionNotFound);
                };
                new_tx
                    .send(WorkerCommand::Write(data.to_vec()))
                    .map_err(|e| TerminalError::Io(e.to_string()))
            }
        }
    }

    async fn resize(&mut self, cols: u16, rows: u16) -> Result<(), TerminalError> {
        let Some(tx) = self.cmd_tx.as_ref() else {
            return Ok(());
        };
        tx.send(WorkerCommand::Resize(cols, rows))
            .map_err(|e| TerminalError::Io(e.to_string()))
    }

    async fn disconnect(&mut self) -> Result<(), TerminalError> {
        if let Some(tx) = self.cmd_tx.take() {
            let _ = tx.send(WorkerCommand::Disconnect);
        }
        self.output_rx = None;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use ssh2::Session as Ssh2Session;
    use std::env;
    use std::io::Read;
    use std::net::TcpStream;

    #[test]
    fn ssh2_backend_probe_exec() {
        let host = env::var("RSHELL_TEST_HOST").expect("RSHELL_TEST_HOST not set");
        let user = env::var("RSHELL_TEST_USER").expect("RSHELL_TEST_USER not set");
        let pass = env::var("RSHELL_TEST_PASS").expect("RSHELL_TEST_PASS not set");
        let addr = format!("{host}:22");

        let tcp = TcpStream::connect(addr).expect("tcp connect failed");
        let mut sess = Ssh2Session::new().expect("create ssh2 session failed");
        sess.set_tcp_stream(tcp);
        sess.handshake().expect("ssh handshake failed");
        sess.userauth_password(&user, &pass)
            .expect("ssh password auth failed");
        assert!(sess.authenticated(), "session not authenticated");

        let mut channel = sess.channel_session().expect("open channel failed");
        channel
            .exec("echo __RSHELL_BACKEND_OK__")
            .expect("exec command failed");
        let mut output = String::new();
        channel
            .read_to_string(&mut output)
            .expect("read command output failed");
        channel.wait_close().expect("wait close failed");

        assert!(
            output.contains("__RSHELL_BACKEND_OK__"),
            "unexpected output: {output}"
        );
    }
}
