//! SSH 阻塞线程 worker：在独立 `std::thread` 里跑 `ssh2`，通过 channel 与 async 侧桥接。
//!
//! `WorkerCommand` 写终端、改 PTY 尺寸、断开；输出经 `tokio::mpsc` 送回主循环。

mod shell;

use ssh2::Session as Ssh2Session;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::sync::mpsc as std_mpsc;
use std::thread;
use std::time::Duration;
use tokio::sync::mpsc;

use crate::domain::terminal::TerminalError;

use shell::open_shell_channel;

pub(super) enum WorkerCommand {
    Write(Vec<u8>),
    Resize(u16, u16),
    Disconnect,
}

pub(super) fn start_worker(
    host: String,
    port: u16,
    username: String,
    password: String,
) -> Result<
    (
        std_mpsc::Sender<WorkerCommand>,
        mpsc::UnboundedReceiver<Vec<u8>>,
    ),
    TerminalError,
> {
    let (cmd_tx, cmd_rx) = std_mpsc::channel::<WorkerCommand>();
    let (output_tx, output_rx) = mpsc::unbounded_channel::<Vec<u8>>();
    let (init_tx, init_rx) = std_mpsc::channel::<Result<(), String>>();

    thread::spawn(move || {
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

        let mut ssh = match Ssh2Session::new() {
            Ok(s) => s,
            Err(e) => {
                let _ = init_tx.send(Err(format!("session init failed: {e}")));
                let _ =
                    output_tx.send(format!("\r\n[ssh] session init failed: {e}\r\n").into_bytes());
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
                            if text.contains("closed channel") || text.contains("channel is closed")
                            {
                                if let Some(new_channel) = open_shell_channel(&ssh, &output_tx) {
                                    channel = new_channel;
                                    let _ =
                                        output_tx.send(b"\r\n[ssh] channel reopened\r\n".to_vec());
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
                        let _ =
                            output_tx.send(format!("\r\n[ssh] read failed: {e}\r\n").into_bytes());
                        let text = e.to_string();
                        if text.contains("transport read") {
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
