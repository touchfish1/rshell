use uuid::Uuid;

use crate::app::state::AppState;
use crate::domain::redis::{RedisConnection, RedisConnectionInput};

impl AppState {
    pub async fn list_redis_connections(&self) -> Vec<RedisConnection> {
        let env = self.get_current_environment().await;
        self.redis_connections
            .lock()
            .await
            .iter()
            .filter(|c| c.environment == env)
            .cloned()
            .collect()
    }

    pub async fn create_redis_connection(
        &self,
        input: RedisConnectionInput,
        secret: Option<String>,
    ) -> Result<RedisConnection, String> {
        let mut conn = input.into_connection();
        conn.environment = self.get_current_environment().await;
        {
            let mut conns = self.redis_connections.lock().await;
            conns.push(conn.clone());
            self.store
                .save_all_redis(&conns)
                .map_err(|e| e.to_string())?;
        }
        if let Some(secret) = secret {
            self.store
                .set_redis_secret(conn.id, &secret)
                .map_err(|e| e.to_string())?;
        }
        Ok(conn)
    }

    pub async fn update_redis_connection(
        &self,
        id: Uuid,
        input: RedisConnectionInput,
        secret: Option<String>,
    ) -> Result<RedisConnection, String> {
        let mut conns = self.redis_connections.lock().await;
        let idx = conns
            .iter()
            .position(|c| c.id == id)
            .ok_or_else(|| "redis connection not found".to_string())?;
        let target = &mut conns[idx];
        target.name = input.name;
        target.address = input.address;
        target.db = input.db.unwrap_or(0);
        let updated = target.clone();
        self.store
            .save_all_redis(&conns)
            .map_err(|e| e.to_string())?;
        if let Some(secret) = secret {
            self.store
                .set_redis_secret(id, &secret)
                .map_err(|e| e.to_string())?;
        }
        Ok(updated)
    }

    pub async fn delete_redis_connection(&self, id: Uuid) -> Result<(), String> {
        let mut conns = self.redis_connections.lock().await;
        conns.retain(|c| c.id != id);
        self.store
            .save_all_redis(&conns)
            .map_err(|e| e.to_string())?;
        self.store
            .delete_redis_secret(id)
            .map_err(|e| e.to_string())?;
        self.active_redis.lock().await.remove(&id);
        Ok(())
    }

    pub async fn get_redis_secret(&self, id: Uuid) -> Result<Option<String>, String> {
        self.store.get_redis_secret(id).map_err(|e| e.to_string())
    }
}
