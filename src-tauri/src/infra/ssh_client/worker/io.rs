use ssh2::{Channel, Session as Ssh2Session};
use std::io::{Read, Write};
use std::sync::mpsc as std_mpsc;
use tokio::sync::mpsc;

use super::{shell::open_shell_channel, WorkerCommand};

pub(super) fn handle_worker_command(
    cmd: WorkerCommand,
    channel: &mut Channel,
    ssh: &Ssh2Session,
    output_tx: &mpsc::UnboundedSender<Vec<u8>>,
) -> bool {
    match cmd {
        WorkerCommand::Write(data) => {
            let normalized = data
                .into_iter()
                .map(|b| if b == b'\r' { b'\n' } else { b })
                .collect::<Vec<u8>>();
            if let Err(e) = channel.write_all(&normalized) {
                let text = e.to_string();
                if text.contains("closed channel") || text.contains("channel is closed") {
                    if let Some(new_channel) = open_shell_channel(ssh, output_tx) {
                        *channel = new_channel;
                        let _ = output_tx.send(b"\r\n[ssh] channel reopened\r\n".to_vec());
                        let _ = channel.write_all(&normalized);
                    } else {
                        let _ = output_tx.send(b"\r\n[ssh] reopen failed\r\n".to_vec());
                        return false;
                    }
                }
                let _ = output_tx.send(format!("\r\n[ssh] write failed: {e}\r\n").into_bytes());
            }
            let _ = channel.flush();
            true
        }
        WorkerCommand::Resize(cols, rows) => {
            let _ = channel.request_pty_size(cols as u32, rows as u32, None, None);
            true
        }
        WorkerCommand::Disconnect => {
            let _ = channel.close();
            let _ = channel.wait_close();
            false
        }
    }
}

pub(super) fn drain_worker_commands(
    cmd_rx: &std_mpsc::Receiver<WorkerCommand>,
    channel: &mut Channel,
    ssh: &Ssh2Session,
    output_tx: &mpsc::UnboundedSender<Vec<u8>>,
) -> bool {
    while let Ok(cmd) = cmd_rx.try_recv() {
        if !handle_worker_command(cmd, channel, ssh, output_tx) {
            return false;
        }
    }
    true
}

pub(super) fn read_channel_output(
    channel: &mut Channel,
    ssh: &Ssh2Session,
    output_tx: &mpsc::UnboundedSender<Vec<u8>>,
    buf: &mut [u8; 8192],
) -> bool {
    match channel.read(buf) {
        Ok(n) if n > 0 => {
            let _ = output_tx.send(buf[..n].to_vec());
            true
        }
        Ok(_) => {
            if channel.eof() {
                let _ = output_tx.send(b"\r\n[ssh] remote closed, reopen\r\n".to_vec());
                let _ = channel.close();
                let _ = channel.wait_close();
                if let Some(new_channel) = open_shell_channel(ssh, output_tx) {
                    *channel = new_channel;
                    let _ = output_tx.send(b"\r\n[ssh] channel reopened\r\n".to_vec());
                    return true;
                }
                return false;
            }
            true
        }
        Err(e) => {
            if e.kind() != std::io::ErrorKind::WouldBlock
                && e.kind() != std::io::ErrorKind::TimedOut
                && e.kind() != std::io::ErrorKind::Interrupted
            {
                let _ = output_tx.send(format!("\r\n[ssh] read failed: {e}\r\n").into_bytes());
                let text = e.to_string();
                if text.contains("transport read") {
                    std::thread::sleep(std::time::Duration::from_millis(50));
                    return true;
                }
                if text.contains("closed channel") || text.contains("channel is closed") {
                    if let Some(new_channel) = open_shell_channel(ssh, output_tx) {
                        *channel = new_channel;
                        let _ = output_tx.send(b"\r\n[ssh] channel reopened\r\n".to_vec());
                        return true;
                    }
                }
                return false;
            }
            true
        }
    }
}

