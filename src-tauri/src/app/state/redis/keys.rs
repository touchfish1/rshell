use uuid::Uuid;

use crate::app::state::AppState;

impl AppState {
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
}
