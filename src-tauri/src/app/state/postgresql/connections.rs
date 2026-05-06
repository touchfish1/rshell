use uuid::Uuid;

use crate::app::state::AppState;
use crate::domain::postgresql::{PostgreSqlConnection, PostgreSqlConnectionInput};

impl AppState {
    pub async fn list_postgresql_connections(&self) -> Vec<PostgreSqlConnection> {
        let env = self.get_current_environment().await;
        self.postgresql_connections
            .lock()
            .await
            .iter()
            .filter(|c| c.environment == env)
            .cloned()
            .collect()
    }

    pub async fn create_postgresql_connection(
        &self,
        input: PostgreSqlConnectionInput,
        secret: Option<String>,
    ) -> Result<PostgreSqlConnection, String> {
        let mut conn = input.into_connection();
        conn.environment = self.get_current_environment().await;
        {
            let mut conns = self.postgresql_connections.lock().await;
            conns.push(conn.clone());
            self.store
                .save_all_postgresql(&conns)
                .map_err(|e| e.to_string())?;
        }
        if let Some(secret) = secret {
            self.store
                .set_postgresql_secret(conn.id, &secret)
                .map_err(|e| e.to_string())?;
        }
        Ok(conn)
    }

    pub async fn update_postgresql_connection(
        &self,
        id: Uuid,
        input: PostgreSqlConnectionInput,
        secret: Option<String>,
    ) -> Result<PostgreSqlConnection, String> {
        let mut conns = self.postgresql_connections.lock().await;
        let idx = conns
            .iter()
            .position(|c| c.id == id)
            .ok_or_else(|| "postgresql connection not found".to_string())?;
        let target = &mut conns[idx];
        target.name = input.name;
        target.host = input.host;
        target.port = input.port.unwrap_or(5432);
        target.username = input.username;
        target.database = input.database;
        let updated = target.clone();
        self.store
            .save_all_postgresql(&conns)
            .map_err(|e| e.to_string())?;
        if let Some(secret) = secret {
            self.store
                .set_postgresql_secret(id, &secret)
                .map_err(|e| e.to_string())?;
        }
        self.active_postgresql.lock().await.remove(&id);
        Ok(updated)
    }

    pub async fn delete_postgresql_connection(&self, id: Uuid) -> Result<(), String> {
        let mut conns = self.postgresql_connections.lock().await;
        conns.retain(|c| c.id != id);
        self.store
            .save_all_postgresql(&conns)
            .map_err(|e| e.to_string())?;
        self.store
            .delete_postgresql_secret(id)
            .map_err(|e| e.to_string())?;
        self.active_postgresql.lock().await.remove(&id);
        Ok(())
    }

    pub async fn get_postgresql_secret(&self, id: Uuid) -> Result<Option<String>, String> {
        self.store
            .get_postgresql_secret(id)
            .map_err(|e| e.to_string())
    }
}
