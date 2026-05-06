use tauri::State;
use uuid::Uuid;

use super::audit::audit_postgresql_event;
use crate::app::{AppState, PostgreSqlColumnInfo, PostgreSqlQueryResult, PostgreSqlTableInfo};

pub async fn postgresql_list_databases(
    state: State<'_, AppState>,
    id: String,
) -> Result<Vec<String>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.postgresql_list_databases(id).await
}

pub async fn postgresql_list_tables(
    state: State<'_, AppState>,
    id: String,
    schema: String,
) -> Result<Vec<PostgreSqlTableInfo>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.postgresql_list_tables(id, schema).await
}

pub async fn postgresql_list_columns(
    state: State<'_, AppState>,
    id: String,
    schema: String,
    table: String,
) -> Result<Vec<PostgreSqlColumnInfo>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.postgresql_list_columns(id, schema, table).await
}

pub async fn postgresql_execute_query(
    state: State<'_, AppState>,
    id: String,
    sql: String,
    limit: Option<u64>,
    offset: Option<u64>,
    schema: Option<String>,
) -> Result<PostgreSqlQueryResult, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let command: String = sql.chars().take(220).collect();
    match state
        .postgresql_execute_query(id, sql, limit, offset, schema)
        .await
    {
        Ok(result) => {
            audit_postgresql_event(
                &state,
                id,
                "postgresql_execute_query",
                format!(
                    "execute query rows={} affected={}",
                    result.rows.len(),
                    result.affected_rows
                ),
                Some(command),
            )
            .await;
            Ok(result)
        }
        Err(err) => {
            audit_postgresql_event(
                &state,
                id,
                "postgresql_execute_query_failed",
                format!("execute query failed: {err}"),
                Some(command),
            )
            .await;
            Err(err)
        }
    }
}

pub async fn postgresql_explain_query(
    state: State<'_, AppState>,
    id: String,
    sql: String,
) -> Result<PostgreSqlQueryResult, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.postgresql_explain_query(id, sql).await
}
