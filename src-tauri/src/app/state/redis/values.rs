use uuid::Uuid;

use crate::app::state::AppState;

impl AppState {
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
