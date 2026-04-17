use std::sync::Arc;

use uuid::Uuid;

use crate::app::state::{ActiveTerminal, AppState};
use crate::domain::session::{Protocol, Session};
use crate::domain::terminal::TerminalClient;
use crate::infra::ssh_client::SshClient;
use crate::infra::telnet_client::TelnetClient;

impl AppState {
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
                client: tokio::sync::Mutex::new(client),
            }),
        );
        Ok(())
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
            active
                .get(&id)
                .cloned()
                .ok_or_else(|| "inactive session".to_string())?
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
            active
                .get(&id)
                .cloned()
                .ok_or_else(|| "inactive session".to_string())?
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
            active
                .get(&id)
                .cloned()
                .ok_or_else(|| "inactive session".to_string())?
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

    pub(super) async fn find_session(&self, id: Uuid) -> Result<Session, String> {
        self.sessions
            .lock()
            .await
            .iter()
            .find(|s| s.id == id)
            .cloned()
            .ok_or_else(|| "session not found".to_string())
    }
}

