use std::sync::Arc;

use sqlx::PgPool;
use uuid::Uuid;

use crate::app::state::{ActivePostgreSql, AppState};

impl AppState {
    pub async fn connect_postgresql(&self, id: Uuid, secret: Option<String>) -> Result<(), String> {
        if self.active_postgresql.lock().await.contains_key(&id) {
            return Ok(());
        }
        let conn = {
            let conns = self.postgresql_connections.lock().await;
            conns
                .iter()
                .find(|c| c.id == id)
                .cloned()
                .ok_or_else(|| "postgresql connection not found".to_string())?
        };
        let password = match secret {
            Some(v) => Some(v),
            None => self
                .store
                .get_postgresql_secret(id)
                .map_err(|e| e.to_string())?,
        };
        let mut url = format!("postgres://{}:", conn.username);
        url.push_str(&urlencoding::encode(password.as_deref().unwrap_or("")));
        url.push('@');
        url.push_str(&conn.host);
        url.push(':');
        url.push_str(&conn.port.to_string());
        if let Some(db) = &conn.database {
            if !db.trim().is_empty() {
                url.push('/');
                url.push_str(db.trim());
            }
        }
        let pool = PgPool::connect(&url).await.map_err(|e| e.to_string())?;
        sqlx::query("SELECT 1")
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;
        self.active_postgresql
            .lock()
            .await
            .insert(id, Arc::new(ActivePostgreSql { pool }));
        Ok(())
    }

    pub async fn disconnect_postgresql(&self, id: Uuid) -> Result<(), String> {
        self.active_postgresql.lock().await.remove(&id);
        Ok(())
    }

    pub(super) async fn ensure_postgresql_pool(&self, id: Uuid) -> Result<PgPool, String> {
        self.connect_postgresql(id, None).await?;
        let map = self.active_postgresql.lock().await;
        let active = map
            .get(&id)
            .cloned()
            .ok_or_else(|| "postgresql not connected".to_string())?;
        Ok(active.pool.clone())
    }
}
