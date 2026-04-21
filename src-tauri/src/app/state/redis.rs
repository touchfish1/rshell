//! `AppState` 上与 Redis 连接列表、密钥持久化以及基础 key/value 操作相关的实现。

use std::sync::Arc;
use java_serialization::{parse_serialization_stream, ContentElement, StreamObject};

use uuid::Uuid;

use crate::app::state::{ActiveRedis, AppState};
use crate::domain::redis::{RedisConnection, RedisConnectionInput};

impl AppState {
    fn decode_redis_text(bytes: Vec<u8>) -> String {
        if let Some(decoded) = Self::try_decode_java_serialized(&bytes) {
            return decoded;
        }
        String::from_utf8(bytes)
            .unwrap_or_else(|e| String::from_utf8_lossy(&e.into_bytes()).to_string())
    }

    fn try_decode_java_serialized(bytes: &[u8]) -> Option<String> {
        if bytes.len() < 4 || bytes[0] != 0xAC || bytes[1] != 0xED || bytes[2] != 0x00 || bytes[3] != 0x05 {
            return None;
        }
        let (_, stream) = parse_serialization_stream(bytes).ok()?;
        let mut parts = Vec::new();
        for item in &stream.contents {
            if let ContentElement::Object(obj) = item {
                Self::collect_java_strings(obj, &mut parts);
            }
        }
        let joined = parts.join(" | ");
        if joined.trim().is_empty() {
            Some(format!("{stream:?}"))
        } else {
            Some(joined)
        }
    }

    fn collect_java_strings(obj: &StreamObject, parts: &mut Vec<String>) {
        match obj {
            StreamObject::NewString(s) => parts.push(s.value.clone()),
            StreamObject::NewEnum(e) => parts.push(e.constant_name.value.clone()),
            StreamObject::NewObject(o) => {
                if let Some(name) = o.class_name() {
                    parts.push(format!("<{}>", name));
                }
            }
            _ => {}
        }
    }

    pub async fn list_redis_connections(&self) -> Vec<RedisConnection> {
        self.redis_connections.lock().await.clone()
    }

    pub async fn create_redis_connection(
        &self,
        input: RedisConnectionInput,
        secret: Option<String>,
    ) -> Result<RedisConnection, String> {
        let conn = input.into_connection();
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

    async fn ensure_redis_client(&self, id: Uuid) -> Result<::redis::Client, String> {
        self.connect_redis(id, None).await?;
        let map = self.active_redis.lock().await;
        let active = map
            .get(&id)
            .cloned()
            .ok_or_else(|| "redis not connected".to_string())?;
        Ok(active.client.clone())
    }

    pub async fn redis_list_keys(&self, id: Uuid, pattern: Option<String>) -> Result<Vec<String>, String> {
        let client = self.ensure_redis_client(id).await?;
        let mut conn = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(|e| e.to_string())?;
        let pat = pattern.unwrap_or_else(|| "*".to_string());
        let keys: Vec<String> = ::redis::cmd("KEYS")
            .arg(pat)
            .query_async(&mut conn)
            .await
            .map_err(|e| e.to_string())?;
        Ok(keys)
    }

    pub async fn redis_scan_keys(
        &self,
        id: Uuid,
        cursor: u64,
        pattern: Option<String>,
        count: Option<u64>,
    ) -> Result<(u64, Vec<Vec<u8>>), String> {
        let client = self.ensure_redis_client(id).await?;
        let mut conn = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(|e| e.to_string())?;
        let mut cmd = ::redis::cmd("SCAN");
        cmd.arg(cursor.to_string());
        if let Some(pat) = pattern {
            if !pat.trim().is_empty() {
                cmd.arg("MATCH").arg(pat);
            }
        }
        if let Some(c) = count {
            cmd.arg("COUNT").arg(c);
        }
        let (next_cursor_str, keys): (String, Vec<Vec<u8>>) =
            cmd.query_async(&mut conn).await.map_err(|e| e.to_string())?;
        let next_cursor = next_cursor_str.parse::<u64>().map_err(|e| e.to_string())?;
        Ok((next_cursor, keys))
    }

    pub async fn redis_list_databases(&self, id: Uuid) -> Result<Vec<(u32, u64)>, String> {
        let client = self.ensure_redis_client(id).await?;
        let mut conn = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(|e| e.to_string())?;
        let info: String = ::redis::cmd("INFO")
            .arg("keyspace")
            .query_async(&mut conn)
            .await
            .map_err(|e| e.to_string())?;
        let mut out: Vec<(u32, u64)> = Vec::new();
        for line in info.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') || !line.starts_with("db") {
                continue;
            }
            let (db_part, rest) = match line.split_once(':') {
                Some(v) => v,
                None => continue,
            };
            let db_index = db_part
                .strip_prefix("db")
                .ok_or_else(|| "invalid db line".to_string())?
                .parse::<u32>()
                .map_err(|e| e.to_string())?;
            let mut key_count: u64 = 0;
            for kv in rest.split(',') {
                if let Some(value) = kv.trim().strip_prefix("keys=") {
                    key_count = value.parse::<u64>().unwrap_or(0);
                    break;
                }
            }
            out.push((db_index, key_count));
        }
        out.sort_by_key(|(db, _)| *db);
        Ok(out)
    }

    pub async fn redis_get_key_type(&self, id: Uuid, key: Vec<u8>) -> Result<String, String> {
        let client = self.ensure_redis_client(id).await?;
        let mut conn = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(|e| e.to_string())?;
        let key_type: String = ::redis::cmd("TYPE")
            .arg(key)
            .query_async(&mut conn)
            .await
            .map_err(|e| e.to_string())?;
        Ok(key_type)
    }

    pub async fn redis_get_ttl(&self, id: Uuid, key: Vec<u8>) -> Result<i64, String> {
        let client = self.ensure_redis_client(id).await?;
        let mut conn = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(|e| e.to_string())?;
        let ttl: i64 = ::redis::cmd("TTL")
            .arg(key)
            .query_async(&mut conn)
            .await
            .map_err(|e| e.to_string())?;
        Ok(ttl)
    }

    pub async fn redis_set_ttl(&self, id: Uuid, key: Vec<u8>, ttl_seconds: Option<i64>) -> Result<(), String> {
        let client = self.ensure_redis_client(id).await?;
        let mut conn = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(|e| e.to_string())?;
        match ttl_seconds {
            Some(ttl) if ttl >= 0 => {
                let _: i64 = ::redis::cmd("EXPIRE")
                    .arg(key)
                    .arg(ttl)
                    .query_async(&mut conn)
                    .await
                    .map_err(|e| e.to_string())?;
            }
            _ => {
                let _: i64 = ::redis::cmd("PERSIST")
                    .arg(key)
                    .query_async(&mut conn)
                    .await
                    .map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    }

    pub async fn redis_get_string(&self, id: Uuid, key: Vec<u8>) -> Result<Option<String>, String> {
        let client = self.ensure_redis_client(id).await?;
        let mut conn = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(|e| e.to_string())?;
        let value: Option<Vec<u8>> = ::redis::cmd("GET")
            .arg(key)
            .query_async(&mut conn)
            .await
            .map_err(|e| e.to_string())?;
        Ok(value.map(Self::decode_redis_text))
    }

    pub async fn redis_get_hash(&self, id: Uuid, key: Vec<u8>) -> Result<Vec<(Vec<u8>, Vec<u8>)>, String> {
        let client = self.ensure_redis_client(id).await?;
        let mut conn = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(|e| e.to_string())?;
        let pairs: Vec<(Vec<u8>, Vec<u8>)> = ::redis::cmd("HGETALL")
            .arg(key)
            .query_async(&mut conn)
            .await
            .map_err(|e| e.to_string())?;
        Ok(pairs)
    }

    pub async fn redis_get_list(&self, id: Uuid, key: Vec<u8>) -> Result<Vec<Vec<u8>>, String> {
        let client = self.ensure_redis_client(id).await?;
        let mut conn = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(|e| e.to_string())?;
        let items: Vec<Vec<u8>> = ::redis::cmd("LRANGE")
            .arg(key)
            .arg(0)
            .arg(-1)
            .query_async(&mut conn)
            .await
            .map_err(|e| e.to_string())?;
        Ok(items)
    }

    pub async fn redis_get_set(&self, id: Uuid, key: Vec<u8>) -> Result<Vec<Vec<u8>>, String> {
        let client = self.ensure_redis_client(id).await?;
        let mut conn = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(|e| e.to_string())?;
        let members: Vec<Vec<u8>> = ::redis::cmd("SMEMBERS")
            .arg(key)
            .query_async(&mut conn)
            .await
            .map_err(|e| e.to_string())?;
        Ok(members)
    }

    pub async fn redis_get_zset(&self, id: Uuid, key: Vec<u8>) -> Result<Vec<(Vec<u8>, f64)>, String> {
        let client = self.ensure_redis_client(id).await?;
        let mut conn = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(|e| e.to_string())?;
        let raw: Vec<Vec<u8>> = ::redis::cmd("ZRANGE")
            .arg(key)
            .arg(0)
            .arg(-1)
            .arg("WITHSCORES")
            .query_async(&mut conn)
            .await
            .map_err(|e| e.to_string())?;
        let mut out: Vec<(Vec<u8>, f64)> = Vec::new();
        let mut idx = 0;
        while idx + 1 < raw.len() {
            let member = raw[idx].clone();
            let score = String::from_utf8_lossy(&raw[idx + 1]).parse::<f64>().unwrap_or(0.0);
            out.push((member, score));
            idx += 2;
        }
        Ok(out)
    }

    pub async fn redis_set_string(&self, id: Uuid, key: Vec<u8>, value: Vec<u8>) -> Result<(), String> {
        let client = self.ensure_redis_client(id).await?;
        let mut conn = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(|e| e.to_string())?;
        let _: () = ::redis::cmd("SET")
            .arg(key)
            .arg(value)
            .query_async(&mut conn)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    async fn redis_delete_key_internal(&self, id: Uuid, key: &[u8]) -> Result<(), String> {
        let client = self.ensure_redis_client(id).await?;
        let mut conn = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(|e| e.to_string())?;
        let _: i64 = ::redis::cmd("DEL")
            .arg(key)
            .query_async(&mut conn)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn redis_set_hash(
        &self,
        id: Uuid,
        key: Vec<u8>,
        entries: Vec<(Vec<u8>, Vec<u8>)>,
    ) -> Result<(), String> {
        self.redis_delete_key_internal(id, &key).await?;
        if entries.is_empty() {
            return Ok(());
        }
        let client = self.ensure_redis_client(id).await?;
        let mut conn = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(|e| e.to_string())?;
        let mut cmd = ::redis::cmd("HSET");
        cmd.arg(key);
        for (field, value) in entries {
            cmd.arg(field).arg(value);
        }
        let _: i64 = cmd.query_async(&mut conn).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn redis_set_list(&self, id: Uuid, key: Vec<u8>, items: Vec<Vec<u8>>) -> Result<(), String> {
        self.redis_delete_key_internal(id, &key).await?;
        if items.is_empty() {
            return Ok(());
        }
        let client = self.ensure_redis_client(id).await?;
        let mut conn = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(|e| e.to_string())?;
        let mut cmd = ::redis::cmd("RPUSH");
        cmd.arg(key);
        for item in items {
            cmd.arg(item);
        }
        let _: i64 = cmd.query_async(&mut conn).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn redis_set_set(&self, id: Uuid, key: Vec<u8>, members: Vec<Vec<u8>>) -> Result<(), String> {
        self.redis_delete_key_internal(id, &key).await?;
        if members.is_empty() {
            return Ok(());
        }
        let client = self.ensure_redis_client(id).await?;
        let mut conn = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(|e| e.to_string())?;
        let mut cmd = ::redis::cmd("SADD");
        cmd.arg(key);
        for member in members {
            cmd.arg(member);
        }
        let _: i64 = cmd.query_async(&mut conn).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn redis_set_zset(
        &self,
        id: Uuid,
        key: Vec<u8>,
        entries: Vec<(Vec<u8>, f64)>,
    ) -> Result<(), String> {
        self.redis_delete_key_internal(id, &key).await?;
        if entries.is_empty() {
            return Ok(());
        }
        let client = self.ensure_redis_client(id).await?;
        let mut conn = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(|e| e.to_string())?;
        let mut cmd = ::redis::cmd("ZADD");
        cmd.arg(key);
        for (member, score) in entries {
            cmd.arg(score).arg(member);
        }
        let _: i64 = cmd.query_async(&mut conn).await.map_err(|e| e.to_string())?;
        Ok(())
    }
}
