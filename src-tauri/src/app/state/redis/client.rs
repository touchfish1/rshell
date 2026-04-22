use std::sync::Arc;

use uuid::Uuid;

use crate::app::state::{ActiveRedis, AppState};
use crate::domain::redis::RedisConnection;

impl AppState {
    fn parse_host_port(address: &str) -> Result<(String, u16), String> {
        let s = address.trim();
        if s.is_empty() {
            return Err("redis address is empty".to_string());
        }
        let (host, port_str) = s
            .rsplit_once(':')
            .ok_or_else(|| "redis address must be host:port".to_string())?;
        let host = host.trim();
        if host.is_empty() {
            return Err("redis host is empty".to_string());
        }
        let port: u16 = port_str
            .trim()
            .parse()
            .map_err(|_| "redis port must be an integer".to_string())?;
        Ok((host.to_string(), port))
    }

    fn build_connection_info(conn: &RedisConnection, secret: Option<String>) -> Result<::redis::ConnectionInfo, String> {
        let (host, port) = Self::parse_host_port(&conn.address)?;
        Ok(::redis::ConnectionInfo {
            addr: ::redis::ConnectionAddr::Tcp(host, port),
            redis: ::redis::RedisConnectionInfo {
                protocol: ::redis::ProtocolVersion::RESP2,
                db: conn.db as i64,
                username: None,
                password: secret.filter(|s| !s.trim().is_empty()),
            },
        })
    }

    pub async fn connect_redis(&self, id: Uuid, secret: Option<String>) -> Result<(), String> {
        if self.active_redis.lock().await.contains_key(&id) {
            return Ok(());
        }
        let conn = {
            let conns = self.redis_connections.lock().await;
            conns
                .iter()
                .find(|c| c.id == id)
                .cloned()
                .ok_or_else(|| "redis connection not found".to_string())?
        };
        let final_secret = if secret.is_some() {
            secret
        } else {
            self.store.get_redis_secret(id).map_err(|e| e.to_string())?
        };
        let info = Self::build_connection_info(&conn, final_secret)?;
        let client = ::redis::Client::open(info).map_err(|e| e.to_string())?;
        let mut test_conn = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(|e| e.to_string())?;
        let _: ::redis::Value = ::redis::cmd("PING")
            .query_async(&mut test_conn)
            .await
            .map_err(|e| e.to_string())?;
        self.active_redis
            .lock()
            .await
            .insert(id, Arc::new(ActiveRedis { client }));
        Ok(())
    }

    pub async fn disconnect_redis(&self, id: Uuid) -> Result<(), String> {
        self.active_redis.lock().await.remove(&id);
        Ok(())
    }

    pub(super) async fn ensure_redis_client(&self, id: Uuid) -> Result<::redis::Client, String> {
        self.connect_redis(id, None).await?;
        let map = self.active_redis.lock().await;
        let active = map
            .get(&id)
            .cloned()
            .ok_or_else(|| "redis not connected".to_string())?;
        Ok(active.client.clone())
    }
}
