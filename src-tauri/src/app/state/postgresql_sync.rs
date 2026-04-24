use std::path::PathBuf;

use crate::app::state::AppState;

#[derive(Debug, Clone, serde::Serialize)]
pub struct PostgresqlSyncSummary {
    pub environment: String,
    pub sessions: usize,
    pub zookeeper_connections: usize,
    pub redis_connections: usize,
    pub mysql_connections: usize,
    pub synced_at: String,
}

impl AppState {
    fn inject_secret(
        value: serde_json::Value,
        secret: Option<String>,
    ) -> Result<serde_json::Value, String> {
        let mut map = match value {
            serde_json::Value::Object(map) => map,
            _ => return Err("sync payload item is not a JSON object".to_string()),
        };
        match secret {
            Some(v) if !v.trim().is_empty() => {
                map.insert("password".to_string(), serde_json::Value::String(v.clone()));
                map.insert("secret".to_string(), serde_json::Value::String(v));
            }
            _ => {
                map.insert("password".to_string(), serde_json::Value::Null);
                map.insert("secret".to_string(), serde_json::Value::Null);
            }
        }
        Ok(serde_json::Value::Object(map))
    }

    fn load_postgresql_url() -> Result<String, String> {
        if let Ok(v) = std::env::var("RSHELL_POSTGRES_URL") {
            let trimmed = v.trim();
            if !trimmed.is_empty() {
                return Ok(trimmed.to_string());
            }
        }
        let candidates = [
            PathBuf::from("postgresql"),
            PathBuf::from("src-tauri").join("postgresql"),
        ];
        for candidate in candidates {
            if candidate.exists() {
                let raw = std::fs::read_to_string(&candidate).map_err(|e| e.to_string())?;
                let trimmed = raw.trim();
                if !trimmed.is_empty() {
                    return Ok(trimmed.to_string());
                }
            }
        }
        Err("postgresql url not configured; set RSHELL_POSTGRES_URL or provide src-tauri/postgresql".to_string())
    }

    pub async fn sync_connections_to_postgresql(&self) -> Result<PostgresqlSyncSummary, String> {
        let postgresql_url = Self::load_postgresql_url()?;
        let environment = self.get_current_environment().await;
        let sessions = self
            .sessions
            .lock()
            .await
            .iter()
            .filter(|item| item.environment == environment)
            .cloned()
            .collect::<Vec<_>>();
        let zookeeper_connections = self
            .zookeeper_connections
            .lock()
            .await
            .iter()
            .filter(|item| item.environment == environment)
            .cloned()
            .collect::<Vec<_>>();
        let redis_connections = self
            .redis_connections
            .lock()
            .await
            .iter()
            .filter(|item| item.environment == environment)
            .cloned()
            .collect::<Vec<_>>();
        let mysql_connections = self
            .mysql_connections
            .lock()
            .await
            .iter()
            .filter(|item| item.environment == environment)
            .cloned()
            .collect::<Vec<_>>();

        let sessions_json = serde_json::Value::Array(
            sessions
                .iter()
                .map(|item| {
                    let value = serde_json::to_value(item).map_err(|e| e.to_string())?;
                    let secret = self.store.get_secret(item.id).map_err(|e| e.to_string())?;
                    Self::inject_secret(value, secret)
                })
                .collect::<Result<Vec<_>, String>>()?,
        );
        let zookeeper_json = serde_json::Value::Array(
            zookeeper_connections
                .iter()
                .map(|item| {
                    let value = serde_json::to_value(item).map_err(|e| e.to_string())?;
                    let secret = self
                        .store
                        .get_zk_secret(item.id)
                        .map_err(|e| e.to_string())?;
                    Self::inject_secret(value, secret)
                })
                .collect::<Result<Vec<_>, String>>()?,
        );
        let redis_json = serde_json::Value::Array(
            redis_connections
                .iter()
                .map(|item| {
                    let value = serde_json::to_value(item).map_err(|e| e.to_string())?;
                    let secret = self
                        .store
                        .get_redis_secret(item.id)
                        .map_err(|e| e.to_string())?;
                    Self::inject_secret(value, secret)
                })
                .collect::<Result<Vec<_>, String>>()?,
        );
        let mysql_json = serde_json::Value::Array(
            mysql_connections
                .iter()
                .map(|item| {
                    let value = serde_json::to_value(item).map_err(|e| e.to_string())?;
                    let secret = self
                        .store
                        .get_mysql_secret(item.id)
                        .map_err(|e| e.to_string())?;
                    Self::inject_secret(value, secret)
                })
                .collect::<Result<Vec<_>, String>>()?,
        );

        let pool = sqlx::PgPool::connect(&postgresql_url)
            .await
            .map_err(|e| e.to_string())?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS rshell_connection_sync_snapshots (
                id BIGSERIAL PRIMARY KEY,
                synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                environment TEXT NOT NULL,
                sessions_json JSONB NOT NULL,
                zookeeper_connections_json JSONB NOT NULL,
                redis_connections_json JSONB NOT NULL,
                mysql_connections_json JSONB NOT NULL
            )
            "#,
        )
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

        // Backward-compatible migration for existing tables created before `environment` was introduced.
        sqlx::query(
            r#"
            ALTER TABLE rshell_connection_sync_snapshots
            ADD COLUMN IF NOT EXISTS environment TEXT
            "#,
        )
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

        sqlx::query(
            r#"
            INSERT INTO rshell_connection_sync_snapshots
                (environment, sessions_json, zookeeper_connections_json, redis_connections_json, mysql_connections_json)
            VALUES
                ($1, $2, $3, $4, $5)
            "#,
        )
        .bind(environment.clone())
        .bind(sessions_json)
        .bind(zookeeper_json)
        .bind(redis_json)
        .bind(mysql_json)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

        let synced_at = sqlx::query_scalar::<_, String>("SELECT NOW()::text")
            .fetch_one(&pool)
            .await
            .unwrap_or_else(|_| "now".to_string());
        let summary = PostgresqlSyncSummary {
            environment,
            sessions: sessions.len(),
            zookeeper_connections: zookeeper_connections.len(),
            redis_connections: redis_connections.len(),
            mysql_connections: mysql_connections.len(),
            synced_at,
        };
        Ok(summary)
    }
}
