use tauri::State;
use uuid::Uuid;

use crate::app::{AppState, MySqlColumnInfo, MySqlQueryResult, MySqlTableInfo};

pub async fn mysql_list_databases(state: State<'_, AppState>, id: String) -> Result<Vec<String>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.mysql_list_databases(id).await
}

pub async fn mysql_list_tables(
    state: State<'_, AppState>,
    id: String,
    schema: String,
) -> Result<Vec<MySqlTableInfo>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.mysql_list_tables(id, schema).await
}

pub async fn mysql_list_columns(
    state: State<'_, AppState>,
    id: String,
    schema: String,
    table: String,
) -> Result<Vec<MySqlColumnInfo>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.mysql_list_columns(id, schema, table).await
}

pub async fn mysql_execute_query(
    state: State<'_, AppState>,
    id: String,
    sql: String,
    limit: Option<u64>,
    offset: Option<u64>,
) -> Result<MySqlQueryResult, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.mysql_execute_query(id, sql, limit, offset).await
}

pub async fn mysql_explain_query(
    state: State<'_, AppState>,
    id: String,
    sql: String,
) -> Result<MySqlQueryResult, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.mysql_explain_query(id, sql).await
}

pub async fn mysql_alter_table_add_column(
    state: State<'_, AppState>,
    id: String,
    schema: String,
    table: String,
    column_name: String,
    column_type: String,
) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state
        .mysql_alter_table_add_column(id, schema, table, column_name, column_type)
        .await
}
