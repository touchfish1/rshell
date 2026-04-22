use sqlx::Row;
use uuid::Uuid;

use crate::app::state::AppState;
use crate::app::state::mysql::{MySqlColumnInfo, MySqlTableInfo};

impl AppState {
    pub async fn mysql_list_databases(&self, id: Uuid) -> Result<Vec<String>, String> {
        let pool = self.ensure_mysql_pool(id).await?;
        let rows = sqlx::query("SHOW DATABASES")
            .fetch_all(&pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(rows
            .into_iter()
            .filter_map(|r| r.try_get::<String, _>(0).ok())
            .collect())
    }

    pub async fn mysql_list_tables(&self, id: Uuid, schema: String) -> Result<Vec<MySqlTableInfo>, String> {
        let pool = self.ensure_mysql_pool(id).await?;
        let rows = sqlx::query(
            "SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME",
        )
        .bind(schema)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;
        Ok(rows
            .into_iter()
            .map(|r| MySqlTableInfo {
                schema: r.try_get("TABLE_SCHEMA").unwrap_or_default(),
                name: r.try_get("TABLE_NAME").unwrap_or_default(),
                table_type: r.try_get("TABLE_TYPE").unwrap_or_default(),
            })
            .collect())
    }

    pub async fn mysql_list_columns(
        &self,
        id: Uuid,
        schema: String,
        table: String,
    ) -> Result<Vec<MySqlColumnInfo>, String> {
        let pool = self.ensure_mysql_pool(id).await?;
        let rows = sqlx::query(
            "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
        )
        .bind(schema)
        .bind(table)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;
        Ok(rows
            .into_iter()
            .map(|r| MySqlColumnInfo {
                name: r.try_get("COLUMN_NAME").unwrap_or_default(),
                column_type: r.try_get("COLUMN_TYPE").unwrap_or_default(),
                is_nullable: r
                    .try_get::<String, _>("IS_NULLABLE")
                    .map(|v| v == "YES")
                    .unwrap_or(false),
                column_key: r.try_get("COLUMN_KEY").unwrap_or_default(),
                extra: r.try_get("EXTRA").unwrap_or_default(),
                default_value: r.try_get("COLUMN_DEFAULT").ok(),
            })
            .collect())
    }
}
