use std::sync::Arc;

use sqlx::MySqlPool;
use uuid::Uuid;

use crate::app::state::{ActiveMySql, AppState};

impl AppState {
    pub async fn connect_mysql(&self, id: Uuid, secret: Option<String>) -> Result<(), String> {
        if self.active_mysql.lock().await.contains_key(&id) {
            return Ok(());
        }
        let conn = {
            let conns = self.mysql_connections.lock().await;
            conns
                .iter()
                .find(|c| c.id == id)
                .cloned()
                .ok_or_else(|| "mysql connection not found".to_string())?
        };
        let password = match secret {
            Some(v) => Some(v),
            None => self.store.get_mysql_secret(id).map_err(|e| e.to_string())?,
        };
        let mut url = format!("mysql://{}:", conn.username);
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
        let pool = MySqlPool::connect(&url).await.map_err(|e| e.to_string())?;
        sqlx::query("SELECT 1")
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;
        self.active_mysql
            .lock()
            .await
            .insert(id, Arc::new(ActiveMySql { pool }));
        Ok(())
    }

    pub async fn disconnect_mysql(&self, id: Uuid) -> Result<(), String> {
        self.active_mysql.lock().await.remove(&id);
        Ok(())
    }

    pub(super) async fn ensure_mysql_pool(&self, id: Uuid) -> Result<MySqlPool, String> {
        self.connect_mysql(id, None).await?;
        let map = self.active_mysql.lock().await;
        let active = map
            .get(&id)
            .cloned()
            .ok_or_else(|| "mysql not connected".to_string())?;
        Ok(active.pool.clone())
    }
}
