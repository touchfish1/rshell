//! 终端会话抽象：协议无关的读写、改尺寸、断开；由 `infra::ssh_client` / `telnet_client` 实现。

use async_trait::async_trait;
use thiserror::Error;

use super::session::Session;

#[derive(Debug, Error)]
pub enum TerminalError {
    #[error("connection failed: {0}")]
    Connection(String),
    #[error("io failed: {0}")]
    Io(String),
    #[error("session not found")]
    SessionNotFound,
}

#[async_trait]
pub trait TerminalClient: Send + Sync {
    async fn connect(&mut self, session: &Session) -> Result<(), TerminalError>;
    async fn read(&mut self) -> Result<Vec<u8>, TerminalError>;
    async fn write(&mut self, data: &[u8]) -> Result<(), TerminalError>;
    async fn resize(&mut self, cols: u16, rows: u16) -> Result<(), TerminalError>;
    async fn disconnect(&mut self) -> Result<(), TerminalError>;
}

