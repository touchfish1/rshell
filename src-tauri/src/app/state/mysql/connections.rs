use uuid::Uuid;

use crate::app::state::AppState;
use crate::domain::mysql::{MySqlConnection, MySqlConnectionInput};

impl AppState {
    pub async fn list_mysql_connections(&self) -> Vec<MySqlConnection> {
        self.mysql_connections.lock().await.clone()
    }

    pub async fn create_mysql_connection(
        &self,
        input: MySqlConnectionInput,
        secret: Option<String>,
    ) -> Result<MySqlConnection, String> {
        let conn = input.into_connection();
        {
            let mut conns = self.mysql_connections.lock().await;
            conns.push(conn.clone());
            self.store.save_all_mysql(&conns).map_err(|e| e.to_string())?;
        }
        if let Some(secret) = secret {
            self.store
                .set_mysql_secret(conn.id, &secret)
                .map_err(|e| e.to_string())?;
        }
        Ok(conn)
    }

    pub async fn update_mysql_connection(
        &self,
        id: Uuid,
        input: MySqlConnectionInput,
        secret: Option<String>,
    ) -> Result<MySqlConnection, String> {
        let mut conns = self.mysql_connections.lock().await;
        let idx = conns
            .iter()
            .position(|c| c.id == id)
            .ok_or_else(|| "mysql connection not found".to_string())?;
        let target = &mut conns[idx];
        target.name = input.name;
        target.host = input.host;
        target.port = input.port.unwrap_or(3306);
        target.username = input.username;
        target.database = input.database;
        let updated = target.clone();
        self.store.save_all_mysql(&conns).map_err(|e| e.to_string())?;
        if let Some(secret) = secret {
            self.store
                .set_mysql_secret(id, &secret)
                .map_err(|e| e.to_string())?;
        }
        self.active_mysql.lock().await.remove(&id);
        Ok(updated)
    }

    pub async fn delete_mysql_connection(&self, id: Uuid) -> Result<(), String> {
        let mut conns = self.mysql_connections.lock().await;
        conns.retain(|c| c.id != id);
        self.store.save_all_mysql(&conns).map_err(|e| e.to_string())?;
        self.store
            .delete_mysql_secret(id)
            .map_err(|e| e.to_string())?;
        self.active_mysql.lock().await.remove(&id);
        Ok(())
    }

    pub async fn get_mysql_secret(&self, id: Uuid) -> Result<Option<String>, String> {
        self.store.get_mysql_secret(id).map_err(|e| e.to_string())
    }
}
