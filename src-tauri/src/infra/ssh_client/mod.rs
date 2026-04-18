//! SSH 终端实现：在独立线程中跑 `russh`/`ssh2` worker，与异步主循环通过 channel 交换数据。
//!
//! 连接、shell、SFTP 等细节见 `worker` 子模块。

use async_trait::async_trait;
use std::sync::mpsc as std_mpsc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::timeout;

use crate::domain::session::Session;
use crate::domain::terminal::{TerminalClient, TerminalError};

mod worker;

use worker::{start_worker, WorkerCommand};

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

        let (cmd_tx, output_rx) = start_worker(host, port, username, password)?;
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
            start_worker(session.host.clone(), session.port, session.username.clone(), password)?;
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
mod tests;

