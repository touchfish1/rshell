//! `AppState` 上与 Zookeeper 连接列表、密钥持久化以及活跃连接管理相关的实现。

use std::sync::Arc;

use uuid::Uuid;
use zookeeper_client::Client;

use crate::app::state::{ActiveZookeeper, AppState};
use crate::domain::zookeeper::{ZookeeperConnection, ZookeeperConnectionInput};

impl AppState {
    pub async fn list_zookeeper_connections(&self) -> Vec<ZookeeperConnection> {
        let env = self.get_current_environment().await;
        self.zookeeper_connections
            .lock()
            .await
            .iter()
            .filter(|c| c.environment == env)
            .cloned()
            .collect()
    }

    pub async fn create_zookeeper_connection(
        &self,
        input: ZookeeperConnectionInput,
        secret: Option<String>,
    ) -> Result<ZookeeperConnection, String> {
        let mut conn = input.into_connection();
        conn.environment = self.get_current_environment().await;
        {
            let mut conns = self.zookeeper_connections.lock().await;
            conns.push(conn.clone());
            self.store
                .save_all_zk(&conns)
                .map_err(|e| e.to_string())?;
        }
        if let Some(secret) = secret {
            self.store
                .set_zk_secret(conn.id, &secret)
                .map_err(|e| e.to_string())?;
        }
        Ok(conn)
    }

    pub async fn update_zookeeper_connection(
        &self,
        id: Uuid,
        input: ZookeeperConnectionInput,
        secret: Option<String>,
    ) -> Result<ZookeeperConnection, String> {
        let mut conns = self.zookeeper_connections.lock().await;
        let target_index = conns
            .iter()
            .position(|c| c.id == id)
            .ok_or_else(|| "zookeeper connection not found".to_string())?;
        let target = &mut conns[target_index];
        target.name = input.name;
        target.connect_string = input.connect_string;
        target.session_timeout_ms = input.session_timeout_ms.unwrap_or(10_000);
        let updated = target.clone();
        self.store
            .save_all_zk(&conns)
            .map_err(|e| e.to_string())?;
        if let Some(secret) = secret {
            self.store
                .set_zk_secret(id, &secret)
                .map_err(|e| e.to_string())?;
        }
        Ok(updated)
    }

    pub async fn delete_zookeeper_connection(&self, id: Uuid) -> Result<(), String> {
        let mut conns = self.zookeeper_connections.lock().await;
        conns.retain(|c| c.id != id);
        self.store
            .save_all_zk(&conns)
            .map_err(|e| e.to_string())?;
        self.store
            .delete_zk_secret(id)
            .map_err(|e| e.to_string())?;
        self.active_zookeeper.lock().await.remove(&id);
        Ok(())
    }

    pub async fn has_zookeeper_secret(&self, id: Uuid) -> Result<bool, String> {
        let secret = self
            .store
            .get_zk_secret(id)
            .map_err(|e| e.to_string())?;
        Ok(secret.is_some() && !secret.unwrap_or_default().is_empty())
    }

    pub async fn get_zookeeper_secret(&self, id: Uuid) -> Result<Option<String>, String> {
        self.store.get_zk_secret(id).map_err(|e| e.to_string())
    }

    pub async fn connect_zookeeper(
        &self,
        id: Uuid,
        secret: Option<String>,
    ) -> Result<(), String> {
        // already connected
        if self.active_zookeeper.lock().await.contains_key(&id) {
            return Ok(());
        }

        let conn = {
            let conns = self.zookeeper_connections.lock().await;
            conns
                .iter()
                .find(|c| c.id == id)
                .cloned()
                .ok_or_else(|| "zookeeper connection not found".to_string())?
        };

        let client = Client::connect(&conn.connect_string)
            .await
            .map_err(|e| e.to_string())?;

        // Optional digest auth: secret is "user:pass"
        if let Some(secret) = secret {
            if !secret.trim().is_empty() {
                client
                    .auth("digest", secret.as_bytes())
                    .await
                    .map_err(|e| e.to_string())?;
            }
        } else if let Ok(Some(stored)) = self.store.get_zk_secret(id) {
            if !stored.trim().is_empty() {
                client
                    .auth("digest", stored.as_bytes())
                    .await
                    .map_err(|e| e.to_string())?;
            }
        }

        let active = Arc::new(ActiveZookeeper { client });
        self.active_zookeeper.lock().await.insert(id, active);
        Ok(())
    }

    pub async fn disconnect_zookeeper(&self, id: Uuid) -> Result<(), String> {
        self.active_zookeeper.lock().await.remove(&id);
        Ok(())
    }

    pub async fn zk_list_children(&self, id: Uuid, path: String) -> Result<Vec<String>, String> {
        self.connect_zookeeper(id, None).await?;
        let map = self.active_zookeeper.lock().await;
        let active = map
            .get(&id)
            .cloned()
            .ok_or_else(|| "zookeeper not connected".to_string())?;
        drop(map);
        active
            .client
            .list_children(&path)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn zk_get_data(
        &self,
        id: Uuid,
        path: String,
    ) -> Result<(Vec<u8>, zookeeper_client::Stat), String> {
        self.connect_zookeeper(id, None).await?;
        let map = self.active_zookeeper.lock().await;
        let active = map
            .get(&id)
            .cloned()
            .ok_or_else(|| "zookeeper not connected".to_string())?;
        drop(map);
        active
            .client
            .get_data(&path)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn zk_set_data(
        &self,
        id: Uuid,
        path: String,
        data: Vec<u8>,
    ) -> Result<(), String> {
        self.connect_zookeeper(id, None).await?;
        let map = self.active_zookeeper.lock().await;
        let active = map
            .get(&id)
            .cloned()
            .ok_or_else(|| "zookeeper not connected".to_string())?;
        drop(map);
        active
            .client
            .set_data(&path, &data, None)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

