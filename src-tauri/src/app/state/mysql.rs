use std::sync::Arc;

use sqlx::{Column, Executor, MySqlPool, Row};
use uuid::Uuid;

use crate::app::state::{ActiveMySql, AppState};
use crate::domain::mysql::{MySqlConnection, MySqlConnectionInput};

#[derive(Debug, Clone, serde::Serialize)]
pub struct MySqlTableInfo {
    pub schema: String,
    pub name: String,
    pub table_type: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct MySqlColumnInfo {
    pub name: String,
    pub column_type: String,
    pub is_nullable: bool,
    pub column_key: String,
    pub extra: String,
    pub default_value: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct MySqlQueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<Option<String>>>,
    pub affected_rows: u64,
}

impl AppState {
    pub async fn list_mysql_connections(&self) -> Vec<MySqlConnection> {
        self.mysql_connections.lock().await.clone()
    }

    pub async fn create_mysql_connection(
        &self,
        input: MySqlConnectionInput,
        secret: Option<String>,
    ) -> Result<MySqlConnection, String> {
        let conn = input.into_connection();
        {
            let mut conns = self.mysql_connections.lock().await;
            conns.push(conn.clone());
            self.store.save_all_mysql(&conns).map_err(|e| e.to_string())?;
        }
        if let Some(secret) = secret {
            self.store
                .set_mysql_secret(conn.id, &secret)
                .map_err(|e| e.to_string())?;
        }
        Ok(conn)
    }

    pub async fn update_mysql_connection(
        &self,
        id: Uuid,
        input: MySqlConnectionInput,
        secret: Option<String>,
    ) -> Result<MySqlConnection, String> {
        let mut conns = self.mysql_connections.lock().await;
        let idx = conns
            .iter()
            .position(|c| c.id == id)
            .ok_or_else(|| "mysql connection not found".to_string())?;
        let target = &mut conns[idx];
        target.name = input.name;
        target.host = input.host;
        target.port = input.port.unwrap_or(3306);
        target.username = input.username;
        target.database = input.database;
        let updated = target.clone();
        self.store.save_all_mysql(&conns).map_err(|e| e.to_string())?;
        if let Some(secret) = secret {
            self.store
                .set_mysql_secret(id, &secret)
                .map_err(|e| e.to_string())?;
        }
        self.active_mysql.lock().await.remove(&id);
        Ok(updated)
    }

    pub async fn delete_mysql_connection(&self, id: Uuid) -> Result<(), String> {
        let mut conns = self.mysql_connections.lock().await;
        conns.retain(|c| c.id != id);
        self.store.save_all_mysql(&conns).map_err(|e| e.to_string())?;
        self.store
            .delete_mysql_secret(id)
            .map_err(|e| e.to_string())?;
        self.active_mysql.lock().await.remove(&id);
        Ok(())
    }

    pub async fn get_mysql_secret(&self, id: Uuid) -> Result<Option<String>, String> {
        self.store.get_mysql_secret(id).map_err(|e| e.to_string())
    }

    pub async fn connect_mysql(&self, id: Uuid, secret: Option<String>) -> Result<(), String> {
        if self.active_mysql.lock().await.contains_key(&id) {
            return Ok(());
        }
        let conn = {
            let conns = self.mysql_connections.lock().await;
            conns
                .iter()
                .find(|c| c.id == id)
                .cloned()
                .ok_or_else(|| "mysql connection not found".to_string())?
        };
        let password = match secret {
            Some(v) => Some(v),
            None => self.store.get_mysql_secret(id).map_err(|e| e.to_string())?,
        };
        let mut url = format!("mysql://{}:", conn.username);
        url.push_str(&urlencoding::encode(password.as_deref().unwrap_or("")));
        url.push('@');
        url.push_str(&conn.host);
        url.push(':');
        url.push_str(&conn.port.to_string());
        if let Some(db) = &conn.database {
            if !db.trim().is_empty() {
                url.push('/');
                url.push_str(db.trim());
            }
        }
        let pool = MySqlPool::connect(&url).await.map_err(|e| e.to_string())?;
        sqlx::query("SELECT 1")
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;
        self.active_mysql
            .lock()
            .await
            .insert(id, Arc::new(ActiveMySql { pool }));
        Ok(())
    }

    pub async fn disconnect_mysql(&self, id: Uuid) -> Result<(), String> {
        self.active_mysql.lock().await.remove(&id);
        Ok(())
    }

    async fn ensure_mysql_pool(&self, id: Uuid) -> Result<MySqlPool, String> {
        self.connect_mysql(id, None).await?;
        let map = self.active_mysql.lock().await;
        let active = map
            .get(&id)
            .cloned()
            .ok_or_else(|| "mysql not connected".to_string())?;
        Ok(active.pool.clone())
    }

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

    pub async fn mysql_execute_query(
        &self,
        id: Uuid,
        sql: String,
        _limit: Option<u64>,
        _offset: Option<u64>,
        schema: Option<String>,
    ) -> Result<MySqlQueryResult, String> {
        let pool = self.ensure_mysql_pool(id).await?;
        let mut conn = pool.acquire().await.map_err(|e| e.to_string())?;
        if let Some(schema_name) = schema {
            let trimmed_schema = schema_name.trim();
            if !trimmed_schema.is_empty() {
                let escaped = trimmed_schema.replace('`', "``");
                let use_sql = format!("USE `{escaped}`");
                conn.execute(use_sql.as_str())
                    .await
                    .map_err(|e| e.to_string())?;
            }
        }
        let trimmed = sql.trim().to_lowercase();
        if trimmed.starts_with("use ") {
            // `USE db` is not supported by MySQL prepared statements.
            // Execute it as a raw text query.
            conn.execute(sql.as_str())
                .await
                .map_err(|e| e.to_string())?;
            return Ok(MySqlQueryResult {
                columns: vec![],
                rows: vec![],
                affected_rows: 0,
            });
        }
        if trimmed.starts_with("select") || trimmed.starts_with("show") || trimmed.starts_with("desc") {
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
                            if let Ok(v) = row.try_get::<Option<u64>, _>(idx) {
                                return v.map(|x| x.to_string());
                            }
                            if let Ok(v) = row.try_get::<Option<f64>, _>(idx) {
                                return v.map(|x| x.to_string());
                            }
                            if let Ok(v) = row.try_get::<Option<bool>, _>(idx) {
                                return v.map(|x| if x { "1".to_string() } else { "0".to_string() });
                            }
                            if let Ok(v) = row.try_get::<Option<Vec<u8>>, _>(idx) {
                                return v.map(|bytes| String::from_utf8_lossy(&bytes).to_string());
                            }
                            None
                        })
                        .collect::<Vec<_>>()
                })
                .collect::<Vec<_>>();
            return Ok(MySqlQueryResult {
                columns,
                rows: values,
                affected_rows: 0,
            });
        }
        let result = conn
            .execute(sqlx::query(&sql))
            .await
            .map_err(|e| e.to_string())?;
        Ok(MySqlQueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: result.rows_affected(),
        })
    }

    pub async fn mysql_explain_query(&self, id: Uuid, sql: String) -> Result<MySqlQueryResult, String> {
        self.mysql_execute_query(id, format!("EXPLAIN {sql}"), None, None, None)
            .await
    }

    pub async fn mysql_alter_table_add_column(
        &self,
        id: Uuid,
        schema: String,
        table: String,
        column_name: String,
        column_type: String,
    ) -> Result<(), String> {
        let pool = self.ensure_mysql_pool(id).await?;
        let sql = format!(
            "ALTER TABLE `{}`.`{}` ADD COLUMN `{}` {}",
            schema, table, column_name, column_type
        );
        sqlx::query(&sql)
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}
