use sqlx::{Column, Executor, Row};
use uuid::Uuid;

use crate::app::state::postgresql::PostgreSqlQueryResult;
use crate::app::state::AppState;

impl AppState {
    pub async fn postgresql_execute_query(
        &self,
        id: Uuid,
        sql: String,
        _limit: Option<u64>,
        _offset: Option<u64>,
        schema: Option<String>,
    ) -> Result<PostgreSqlQueryResult, String> {
        let pool = self.ensure_postgresql_pool(id).await?;
        let mut conn = pool.acquire().await.map_err(|e| e.to_string())?;
        if let Some(schema_name) = schema {
            let trimmed_schema = schema_name.trim();
            if !trimmed_schema.is_empty() {
                let escaped = trimmed_schema.replace('"', "\"\"");
                let use_sql = format!("SET search_path TO \"{escaped}\"");
                conn.execute(use_sql.as_str())
                    .await
                    .map_err(|e| e.to_string())?;
            }
        }
        let trimmed = sql.trim().to_lowercase();
        if trimmed.starts_with("select")
            || trimmed.starts_with("show")
            || trimmed.starts_with("with")
            || trimmed.starts_with("explain")
        {
            let rows = sqlx::query(&sql)
                .fetch_all(&mut *conn)
                .await
                .map_err(|e| e.to_string())?;
            let columns = rows
                .first()
                .map(|r| {
                    r.columns()
                        .iter()
                        .map(|col| col.name().to_string())
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            let values = rows
                .into_iter()
                .map(|row| {
                    (0..columns.len())
                        .map(|idx| {
                            if let Ok(v) = row.try_get::<Option<String>, _>(idx) {
                                return v;
                            }
                            if let Ok(v) = row.try_get::<Option<i64>, _>(idx) {
                                return v.map(|x| x.to_string());
                            }
                            if let Ok(v) = row.try_get::<Option<f64>, _>(idx) {
                                return v.map(|x| x.to_string());
                            }
                            if let Ok(v) = row.try_get::<Option<bool>, _>(idx) {
                                return v.map(|x| x.to_string());
                            }
                            if let Ok(v) = row.try_get::<Option<Vec<u8>>, _>(idx) {
                                return v.map(|bytes| String::from_utf8_lossy(&bytes).to_string());
                            }
                            None
                        })
                        .collect::<Vec<_>>()
                })
                .collect::<Vec<_>>();
            return Ok(PostgreSqlQueryResult {
                columns,
                rows: values,
                affected_rows: 0,
            });
        }
        let result = conn
            .execute(sqlx::query(&sql))
            .await
            .map_err(|e| e.to_string())?;
        Ok(PostgreSqlQueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: result.rows_affected(),
        })
    }

    pub async fn postgresql_explain_query(
        &self,
        id: Uuid,
        sql: String,
    ) -> Result<PostgreSqlQueryResult, String> {
        self.postgresql_execute_query(id, format!("EXPLAIN {sql}"), None, None, None)
            .await
    }
}
