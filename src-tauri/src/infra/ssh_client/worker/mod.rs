//! SSH 阻塞线程 worker：在独立 `std::thread` 里跑 `ssh2`，通过 channel 与 async 侧桥接。
//!
//! `WorkerCommand` 写终端、改 PTY 尺寸、断开；输出经 `tokio::mpsc` 送回主循环。

mod shell;
mod io;

use ssh2::Session as Ssh2Session;
use std::net::{SocketAddr, TcpStream};
use std::sync::mpsc as std_mpsc;
use std::thread;
use std::time::Duration;
use tokio::sync::mpsc;

use crate::domain::terminal::TerminalError;
use io::{drain_worker_commands, read_channel_output};

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
            if !drain_worker_commands(&cmd_rx, &mut channel, &ssh, &output_tx) {
                return;
            }

            if !read_channel_output(&mut channel, &ssh, &output_tx, &mut buf) {
                return;
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
