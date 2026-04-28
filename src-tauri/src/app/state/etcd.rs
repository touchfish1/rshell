//! `AppState` 上与 Etcd 连接列表、密钥持久化以及活跃连接管理相关的实现。

use std::sync::Arc;

use etcd_client::{Client, ConnectOptions, GetOptions, SortOrder, SortTarget};
use uuid::Uuid;

use crate::app::state::{ActiveEtcd, AppState};
use crate::domain::etcd::{EtcdConnection, EtcdConnectionInput, EtcdKeyValue};

impl AppState {
    pub async fn list_etcd_connections(&self) -> Vec<EtcdConnection> {
        let env = self.get_current_environment().await;
        self.etcd_connections
            .lock()
            .await
            .iter()
            .filter(|c| c.environment == env)
            .cloned()
            .collect()
    }

    pub async fn create_etcd_connection(
        &self,
        input: EtcdConnectionInput,
        secret: Option<String>,
    ) -> Result<EtcdConnection, String> {
        let mut conn = input.into_connection();
        conn.environment = self.get_current_environment().await;
        {
            let mut conns = self.etcd_connections.lock().await;
            conns.push(conn.clone());
            self.store
                .save_all_etcd(&conns)
                .map_err(|e| e.to_string())?;
        }
        if let Some(secret) = secret {
            self.store
                .set_etcd_secret(conn.id, &secret)
                .map_err(|e| e.to_string())?;
        }
        Ok(conn)
    }

    pub async fn update_etcd_connection(
        &self,
        id: Uuid,
        input: EtcdConnectionInput,
        secret: Option<String>,
    ) -> Result<EtcdConnection, String> {
        let mut conns = self.etcd_connections.lock().await;
        let target_index = conns
            .iter()
            .position(|c| c.id == id)
            .ok_or_else(|| "etcd connection not found".to_string())?;
        let target = &mut conns[target_index];
        target.name = input.name;
        target.endpoints = input.endpoints;
        let updated = target.clone();
        self.store
            .save_all_etcd(&conns)
            .map_err(|e| e.to_string())?;
        if let Some(secret) = secret {
            self.store
                .set_etcd_secret(id, &secret)
                .map_err(|e| e.to_string())?;
        }
        Ok(updated)
    }

    pub async fn delete_etcd_connection(&self, id: Uuid) -> Result<(), String> {
        let mut conns = self.etcd_connections.lock().await;
        conns.retain(|c| c.id != id);
        self.store
            .save_all_etcd(&conns)
            .map_err(|e| e.to_string())?;
        self.store
            .delete_etcd_secret(id)
            .map_err(|e| e.to_string())?;
        self.active_etcd.lock().await.remove(&id);
        Ok(())
    }

    pub async fn has_etcd_secret(&self, id: Uuid) -> Result<bool, String> {
        let secret = self
            .store
            .get_etcd_secret(id)
            .map_err(|e| e.to_string())?;
        Ok(secret.is_some() && !secret.unwrap_or_default().is_empty())
    }

    pub async fn get_etcd_secret(&self, id: Uuid) -> Result<Option<String>, String> {
        self.store.get_etcd_secret(id).map_err(|e| e.to_string())
    }

    pub async fn connect_etcd(
        &self,
        id: Uuid,
        secret: Option<String>,
    ) -> Result<(), String> {
        // already connected
        if self.active_etcd.lock().await.contains_key(&id) {
            return Ok(());
        }

        let conn = {
            let conns = self.etcd_connections.lock().await;
            conns
                .iter()
                .find(|c| c.id == id)
                .cloned()
                .ok_or_else(|| "etcd connection not found".to_string())?
        };

        // Parse endpoints (comma-separated)
        let endpoints: Vec<String> = conn
            .endpoints
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        if endpoints.is_empty() {
            return Err("no valid endpoints".to_string());
        }

        let mut opts = ConnectOptions::default();
        // Use stored secret if available
        let password = if let Some(ref s) = secret {
            if !s.trim().is_empty() {
                Some(s.clone())
            } else {
                None
            }
        } else if let Ok(Some(stored)) = self.store.get_etcd_secret(id) {
            if !stored.trim().is_empty() {
                Some(stored)
            } else {
                None
            }
        } else {
            None
        };

        if let Some(ref pass) = password {
            opts = opts.with_user("root", pass.as_str());
        }

        let client = Client::connect(endpoints, Some(opts))
            .await
            .map_err(|e| format!("etcd connect failed: {e}"))?;

        let active = Arc::new(ActiveEtcd {
            client: tokio::sync::Mutex::new(client),
        });
        self.active_etcd.lock().await.insert(id, active);
        Ok(())
    }

    pub async fn disconnect_etcd(&self, id: Uuid) -> Result<(), String> {
        self.active_etcd.lock().await.remove(&id);
        Ok(())
    }

    /// List keys by prefix
    pub async fn etcd_list_keys(&self, id: Uuid, prefix: String) -> Result<Vec<String>, String> {
        self.connect_etcd(id, None).await?;
        let map = self.active_etcd.lock().await;
        let active = map
            .get(&id)
            .cloned()
            .ok_or_else(|| "etcd not connected".to_string())?;
        drop(map);

        let mut client = active.client.lock().await;
        let resp = client
            .get(
                prefix.as_bytes().to_vec(),
                Some(GetOptions::new().with_prefix().with_sort(SortTarget::Key, SortOrder::Ascend)),
            )
            .await
            .map_err(|e| e.to_string())?;

        let keys: Vec<String> = resp
            .kvs()
            .iter()
            .map(|kv| String::from_utf8_lossy(kv.key()).to_string())
            .collect();
        Ok(keys)
    }

    /// Get a single key value
    pub async fn etcd_get_value(
        &self,
        id: Uuid,
        key: String,
    ) -> Result<Option<EtcdKeyValue>, String> {
        self.connect_etcd(id, None).await?;
        let map = self.active_etcd.lock().await;
        let active = map
            .get(&id)
            .cloned()
            .ok_or_else(|| "etcd not connected".to_string())?;
        drop(map);

        let mut client = active.client.lock().await;
        let resp = client
            .get(key.as_bytes().to_vec(), None)
            .await
            .map_err(|e| e.to_string())?;

        if let Some(kv) = resp.kvs().first() {
            Ok(Some(EtcdKeyValue {
                key: String::from_utf8_lossy(kv.key()).to_string(),
                value: String::from_utf8_lossy(kv.value()).to_string(),
                create_revision: kv.create_revision(),
                mod_revision: kv.mod_revision(),
            }))
        } else {
            Ok(None)
        }
    }

    /// Set a key-value
    pub async fn etcd_set_value(
        &self,
        id: Uuid,
        key: String,
        value: String,
    ) -> Result<(), String> {
        self.connect_etcd(id, None).await?;
        let map = self.active_etcd.lock().await;
        let active = map
            .get(&id)
            .cloned()
            .ok_or_else(|| "etcd not connected".to_string())?;
        drop(map);

        let mut client = active.client.lock().await;
        client
            .put(key.as_bytes().to_vec(), value.as_bytes().to_vec(), None)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Delete a key
    pub async fn etcd_delete_key(&self, id: Uuid, key: String) -> Result<(), String> {
        self.connect_etcd(id, None).await?;
        let map = self.active_etcd.lock().await;
        let active = map
            .get(&id)
            .cloned()
            .ok_or_else(|| "etcd not connected".to_string())?;
        drop(map);

        let mut client = active.client.lock().await;
        client.delete(key.as_bytes().to_vec(), None)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}
