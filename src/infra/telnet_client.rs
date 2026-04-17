use async_trait::async_trait;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration};

use crate::domain::session::Session;
use crate::domain::terminal::{TerminalClient, TerminalError};

pub struct TelnetClient {
    stream: Option<TcpStream>,
}

impl TelnetClient {
    pub fn new() -> Self {
        Self { stream: None }
    }
}

#[cfg(test)]
mod tests {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    use crate::domain::session::{Protocol, Session};

    use super::*;

    #[tokio::test]
    async fn connect_and_echo() {
        let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
        let addr = listener.local_addr().expect("addr");
        tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.expect("accept");
            let mut buf = [0_u8; 16];
            let n = socket.read(&mut buf).await.expect("read");
            socket.write_all(&buf[..n]).await.expect("write");
        });

        let session = Session {
            id: uuid::Uuid::new_v4(),
            name: "test".to_string(),
            protocol: Protocol::Telnet,
            host: "127.0.0.1".to_string(),
            port: addr.port(),
            username: "u".to_string(),
            encoding: "utf-8".to_string(),
            keepalive_secs: 30,
        };

        let mut client = TelnetClient::new();
        client.connect(&session).await.expect("connect");
        client.write(b"ping").await.expect("write");
        let output = client.read().await.expect("read");
        assert_eq!(output, b"ping");
    }
}

#[async_trait]
impl TerminalClient for TelnetClient {
    async fn connect(&mut self, session: &Session) -> Result<(), TerminalError> {
        let target = format!("{}:{}", session.host, session.port);
        let stream = timeout(Duration::from_secs(5), TcpStream::connect(target))
            .await
            .map_err(|_| TerminalError::Connection("telnet connect timeout".to_string()))?
            .map_err(|e| TerminalError::Connection(e.to_string()))?;
        self.stream = Some(stream);
        Ok(())
    }

    async fn read(&mut self) -> Result<Vec<u8>, TerminalError> {
        let Some(stream) = self.stream.as_mut() else {
            return Err(TerminalError::SessionNotFound);
        };
        let mut buf = vec![0_u8; 4096];
        let n = match timeout(Duration::from_millis(5), stream.read(&mut buf)).await {
            Ok(res) => res.map_err(|e| TerminalError::Io(e.to_string()))?,
            Err(_) => return Ok(vec![]),
        };
        buf.truncate(n);
        Ok(buf)
    }

    async fn write(&mut self, data: &[u8]) -> Result<(), TerminalError> {
        let Some(stream) = self.stream.as_mut() else {
            return Err(TerminalError::SessionNotFound);
        };
        stream
            .write_all(data)
            .await
            .map_err(|e| TerminalError::Io(e.to_string()))
    }

    async fn resize(&mut self, _cols: u16, _rows: u16) -> Result<(), TerminalError> {
        Ok(())
    }

    async fn disconnect(&mut self) -> Result<(), TerminalError> {
        self.stream = None;
        Ok(())
    }
}
