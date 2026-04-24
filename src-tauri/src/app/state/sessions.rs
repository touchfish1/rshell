//! `AppState` 上与会话列表、密钥持久化相关的实现。

use uuid::Uuid;

use crate::app::state::AppState;
use crate::domain::session::{Session, SessionInput};

impl AppState {
    pub async fn list_sessions(&self) -> Vec<Session> {
        let env = self.get_current_environment().await;
        self.sessions
            .lock()
            .await
            .iter()
            .filter(|s| s.environment == env)
            .cloned()
            .collect()
    }

    pub async fn create_session(
        &self,
        input: SessionInput,
        secret: Option<String>,
    ) -> Result<Session, String> {
        let mut session = input.into_session();
        session.environment = self.get_current_environment().await;
        {
            let mut sessions = self.sessions.lock().await;
            sessions.push(session.clone());
            self.store.save_all(&sessions).map_err(|e| e.to_string())?;
        }
        if let Some(secret) = secret {
            self.store
                .set_secret(session.id, &secret)
                .map_err(|e| e.to_string())?;
        }
        Ok(session)
    }

    pub async fn update_session(
        &self,
        id: Uuid,
        input: SessionInput,
        secret: Option<String>,
    ) -> Result<Session, String> {
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
            self.store
                .set_secret(id, &secret)
                .map_err(|e| e.to_string())?;
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

    pub async fn has_secret(&self, id: Uuid) -> Result<bool, String> {
        let secret = self.store.get_secret(id).map_err(|e| e.to_string())?;
        Ok(secret.is_some() && !secret.unwrap_or_default().is_empty())
    }

    pub async fn get_secret(&self, id: Uuid) -> Result<Option<String>, String> {
        self.store.get_secret(id).map_err(|e| e.to_string())
    }
}
