use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::Mutex;
use uuid::Uuid;

use crate::domain::session::{Protocol, Session, SessionInput};
use crate::domain::terminal::{TerminalClient, TerminalError};
use crate::infra::ssh_client::SshClient;
use crate::infra::store::{SessionStore, StoreError};
use crate::infra::telnet_client::TelnetClient;

pub struct ActiveTerminal {
    pub client: Mutex<Box<dyn TerminalClient>>,
}

pub struct AppState {
    store: SessionStore,
    sessions: Arc<Mutex<Vec<Session>>>,
    active: Arc<Mutex<HashMap<Uuid, Arc<ActiveTerminal>>>>,
}

impl Default for AppState {
    fn default() -> Self {
        let store = SessionStore::new().expect("failed to init session store");
        let sessions = store.list().unwrap_or_default();
        Self {
            store,
            sessions: Arc::new(Mutex::new(sessions)),
            active: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl AppState {
    pub async fn list_sessions(&self) -> Vec<Session> {
        self.sessions.lock().await.clone()
    }

    pub async fn create_session(&self, input: SessionInput, secret: Option<String>) -> Result<Session, String> {
        let session = input.into_session();
        {
            let mut sessions = self.sessions.lock().await;
            sessions.push(session.clone());
            self.store
                .save_all(&sessions)
                .map_err(|e| e.to_string())?;
        }
        if let Some(secret) = secret {
            self.store
                .set_secret(session.id, &secret)
                .map_err(|e| e.to_string())?;
        }
        Ok(session)
    }

    pub async fn update_session(&self, id: Uuid, input: SessionInput, secret: Option<String>) -> Result<Session, String> {
        let mut sessions = self.sessions.lock().await;
        let target_index = sessions
            .iter()
            .position(|s| s.id == id)
            .ok_or_else(|| "session not found".to_string())?;
        let target = &mut sessions[target_index];
        target.name = input.name;
        target.protocol = input.protocol;
        target.host = input.host;
        target.port = input.port;
        target.username = input.username;
        target.encoding = input.encoding.unwrap_or_else(|| "utf-8".to_string());
        target.keepalive_secs = input.keepalive_secs.unwrap_or(30);
        let updated = target.clone();
        self.store.save_all(&sessions).map_err(|e| e.to_string())?;
        if let Some(secret) = secret {
            self.store.set_secret(id, &secret).map_err(|e| e.to_string())?;
        }
        Ok(updated)
    }

    pub async fn delete_session(&self, id: Uuid) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        sessions.retain(|s| s.id != id);
        self.store.save_all(&sessions).map_err(|e| e.to_string())?;
        self.store.delete_secret(id).map_err(|e| e.to_string())?;
        self.active.lock().await.remove(&id);
        Ok(())
    }

    pub async fn connect_session(&self, id: Uuid, secret_override: Option<String>) -> Result<(), String> {
        let session = self
            .sessions
            .lock()
            .await
            .iter()
            .find(|s| s.id == id)
            .cloned()
            .ok_or_else(|| "session not found".to_string())?;
        let secret = if secret_override.is_some() {
            secret_override
        } else {
            self.store.get_secret(id).map_err(|e| e.to_string())?
        };

        let mut client: Box<dyn TerminalClient> = match session.protocol {
            Protocol::Ssh => Box::new(SshClient::new(secret)),
            Protocol::Telnet => Box::new(TelnetClient::new()),
        };
        client.connect(&session).await.map_err(|e| e.to_string())?;

        self.active.lock().await.insert(
            id,
            Arc::new(ActiveTerminal {
                client: Mutex::new(client),
            }),
        );
        Ok(())
    }

    pub async fn has_secret(&self, id: Uuid) -> Result<bool, String> {
        let secret = self.store.get_secret(id).map_err(|e| e.to_string())?;
        Ok(secret.is_some() && !secret.unwrap_or_default().is_empty())
    }

    pub async fn disconnect_session(&self, id: Uuid) -> Result<(), String> {
        let terminal = {
            let mut active = self.active.lock().await;
            active.remove(&id)
        };
        if let Some(term) = terminal {
            term.client
                .lock()
                .await
                .disconnect()
                .await
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub async fn send_input(&self, id: Uuid, text: String) -> Result<(), String> {
        let term = {
            let active = self.active.lock().await;
            active.get(&id).cloned().ok_or_else(|| "inactive session".to_string())?
        };
        let result = term
            .client
            .lock()
            .await
            .write(text.as_bytes())
            .await
            .map_err(|e| e.to_string());
        result
    }

    pub async fn resize_terminal(&self, id: Uuid, cols: u16, rows: u16) -> Result<(), String> {
        let term = {
            let active = self.active.lock().await;
            active.get(&id).cloned().ok_or_else(|| "inactive session".to_string())?
        };
        let result = term
            .client
            .lock()
            .await
            .resize(cols, rows)
            .await
            .map_err(|e| e.to_string());
        result
    }

    pub async fn poll_output(&self, id: Uuid) -> Result<Vec<u8>, String> {
        let term = {
            let active = self.active.lock().await;
            active.get(&id).cloned().ok_or_else(|| "inactive session".to_string())?
        };
        let result = term
            .client
            .lock()
            .await
            .read()
            .await
            .map_err(|e| e.to_string());
        result
    }
}

impl From<TerminalError> for String {
    fn from(value: TerminalError) -> Self {
        value.to_string()
    }
}

impl From<StoreError> for String {
    fn from(value: StoreError) -> Self {
        value.to_string()
    }
}

#[cfg(test)]
mod tests {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    use crate::domain::session::{Protocol, SessionInput};

    use super::AppState;

    async fn spawn_echo_server() -> u16 {
        let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind echo server");
        let port = listener.local_addr().expect("read local addr").port();
        tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.expect("accept client");
            let mut buf = [0_u8; 1024];
            let n = socket.read(&mut buf).await.expect("read payload");
            socket.write_all(&buf[..n]).await.expect("echo payload");
        });
        port
    }

    async fn assert_session_roundtrip(protocol: Protocol, port: u16, payload: &str) {
        let state = AppState::default();
        let session = state
            .create_session(
                SessionInput {
                    name: format!("{protocol:?}-test"),
                    protocol,
                    host: "127.0.0.1".to_string(),
                    port,
                    username: "tester".to_string(),
                    encoding: Some("utf-8".to_string()),
                    keepalive_secs: Some(30),
                },
                None,
            )
            .await
            .expect("create session");

        state
            .connect_session(session.id, None)
            .await
            .expect("connect session");
        state
            .send_input(session.id, payload.to_string())
            .await
            .expect("send payload");
        let output = state.poll_output(session.id).await.expect("poll output");
        assert_eq!(String::from_utf8_lossy(&output), payload);
        state
            .disconnect_session(session.id)
            .await
            .expect("disconnect session");
        state
            .delete_session(session.id)
            .await
            .expect("cleanup session");
    }

    #[tokio::test]
    async fn telnet_session_create_and_io_roundtrip() {
        let port = spawn_echo_server().await;
        assert_session_roundtrip(Protocol::Telnet, port, "telnet-ping").await;
    }

    #[tokio::test]
    async fn ssh_session_without_secret_fails() {
        let state = AppState::default();
        let session = state
            .create_session(
                SessionInput {
                    name: "ssh-test".to_string(),
                    protocol: Protocol::Ssh,
                    host: "127.0.0.1".to_string(),
                    port: 22,
                    username: "tester".to_string(),
                    encoding: Some("utf-8".to_string()),
                    keepalive_secs: Some(30),
                },
                None,
            )
            .await
            .expect("create session");

        let err = state
            .connect_session(session.id, None)
            .await
            .expect_err("connect should fail without secret");
        assert!(err.contains("missing SSH password"));
        state
            .delete_session(session.id)
            .await
            .expect("cleanup session");
    }
}
