use sqlx::Row;
use uuid::Uuid;

use crate::app::state::postgresql::{PostgreSqlColumnInfo, PostgreSqlTableInfo};
use crate::app::state::AppState;

impl AppState {
    pub async fn postgresql_list_databases(&self, id: Uuid) -> Result<Vec<String>, String> {
        let pool = self.ensure_postgresql_pool(id).await?;
        let rows = sqlx::query(
            "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname",
        )
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;
        Ok(rows
            .into_iter()
            .filter_map(|r| r.try_get::<String, _>(0).ok())
            .collect())
    }

    pub async fn postgresql_list_tables(
        &self,
        id: Uuid,
        schema: String,
    ) -> Result<Vec<PostgreSqlTableInfo>, String> {
        let pool = self.ensure_postgresql_pool(id).await?;
        let rows = sqlx::query(
            "SELECT table_schema, table_name, table_type FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name",
        )
        .bind(schema)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;
        Ok(rows
            .into_iter()
            .map(|r| PostgreSqlTableInfo {
                schema: r.try_get("table_schema").unwrap_or_default(),
                name: r.try_get("table_name").unwrap_or_default(),
                table_type: r.try_get("table_type").unwrap_or_default(),
            })
            .collect())
    }

    pub async fn postgresql_list_columns(
        &self,
        id: Uuid,
        schema: String,
        table: String,
    ) -> Result<Vec<PostgreSqlColumnInfo>, String> {
        let pool = self.ensure_postgresql_pool(id).await?;
        let rows = sqlx::query(
            r#"
            SELECT c.column_name,
                   c.udt_name AS column_type,
                   c.is_nullable,
                   COALESCE(tc.constraint_type, '') AS column_key,
                   '' AS extra,
                   c.column_default
            FROM information_schema.columns c
            LEFT JOIN information_schema.key_column_usage kcu
              ON c.table_schema = kcu.table_schema
             AND c.table_name = kcu.table_name
             AND c.column_name = kcu.column_name
            LEFT JOIN information_schema.table_constraints tc
              ON kcu.constraint_name = tc.constraint_name
             AND kcu.table_schema = tc.table_schema
             AND kcu.table_name = tc.table_name
            WHERE c.table_schema = $1 AND c.table_name = $2
            ORDER BY c.ordinal_position
            "#,
        )
        .bind(schema)
        .bind(table)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;
        Ok(rows
            .into_iter()
            .map(|r| PostgreSqlColumnInfo {
                name: r.try_get("column_name").unwrap_or_default(),
                column_type: r.try_get("column_type").unwrap_or_default(),
                is_nullable: r
                    .try_get::<String, _>("is_nullable")
                    .map(|v| v == "YES")
                    .unwrap_or(false),
                column_key: r.try_get("column_key").unwrap_or_default(),
                extra: r.try_get("extra").unwrap_or_default(),
                default_value: r.try_get("column_default").ok(),
            })
            .collect())
    }
}
