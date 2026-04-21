use tauri::State;
use uuid::Uuid;

use crate::app::{AppState, MySqlColumnInfo, MySqlQueryResult, MySqlTableInfo};
use super::audit::audit_mysql_event;

pub async fn mysql_list_databases(state: State<'_, AppState>, id: String) -> Result<Vec<String>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    match state.mysql_list_databases(id).await {
        Ok(databases) => {
            audit_mysql_event(
                &state,
                id,
                "mysql_list_databases",
                format!("list databases count={}", databases.len()),
                Some("SHOW DATABASES".to_string()),
            )
            .await;
            Ok(databases)
        }
        Err(err) => {
            audit_mysql_event(
                &state,
                id,
                "mysql_list_databases_failed",
                format!("list databases failed: {err}"),
                Some("SHOW DATABASES".to_string()),
            )
            .await;
            Err(err)
        }
    }
}

pub async fn mysql_list_tables(
    state: State<'_, AppState>,
    id: String,
    schema: String,
) -> Result<Vec<MySqlTableInfo>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let op_schema = schema.clone();
    match state.mysql_list_tables(id, schema).await {
        Ok(tables) => {
            audit_mysql_event(
                &state,
                id,
                "mysql_list_tables",
                format!("list tables schema={op_schema} count={}", tables.len()),
                Some(format!("SHOW TABLES FROM `{op_schema}`")),
            )
            .await;
            Ok(tables)
        }
        Err(err) => {
            audit_mysql_event(
                &state,
                id,
                "mysql_list_tables_failed",
                format!("list tables failed schema={op_schema}: {err}"),
                Some(format!("SHOW TABLES FROM `{op_schema}`")),
            )
            .await;
            Err(err)
        }
    }
}

pub async fn mysql_list_columns(
    state: State<'_, AppState>,
    id: String,
    schema: String,
    table: String,
) -> Result<Vec<MySqlColumnInfo>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let op_schema = schema.clone();
    let op_table = table.clone();
    match state.mysql_list_columns(id, schema, table).await {
        Ok(columns) => {
            audit_mysql_event(
                &state,
                id,
                "mysql_list_columns",
                format!("list columns schema={op_schema} table={op_table} count={}", columns.len()),
                Some(format!("SHOW FULL COLUMNS FROM `{op_schema}`.`{op_table}`")),
            )
            .await;
            Ok(columns)
        }
        Err(err) => {
            audit_mysql_event(
                &state,
                id,
                "mysql_list_columns_failed",
                format!("list columns failed schema={op_schema} table={op_table}: {err}"),
                Some(format!("SHOW FULL COLUMNS FROM `{op_schema}`.`{op_table}`")),
            )
            .await;
            Err(err)
        }
    }
}

pub async fn mysql_execute_query(
    state: State<'_, AppState>,
    id: String,
    sql: String,
    limit: Option<u64>,
    offset: Option<u64>,
    schema: Option<String>,
) -> Result<MySqlQueryResult, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let trimmed_sql = sql.trim();
    let command = if trimmed_sql.is_empty() {
        "QUERY".to_string()
    } else {
        let preview = trimmed_sql.lines().next().unwrap_or("QUERY");
        preview.chars().take(220).collect()
    };
    match state.mysql_execute_query(id, sql, limit, offset, schema.clone()).await {
        Ok(result) => {
            let schema_text = schema.unwrap_or_else(|| "-".to_string());
            audit_mysql_event(
                &state,
                id,
                "mysql_execute_query",
                format!(
                    "execute query schema={schema_text} rows={} affected={}",
                    result.rows.len(),
                    result.affected_rows
                ),
                Some(command),
            )
            .await;
            Ok(result)
        }
        Err(err) => {
            let schema_text = schema.unwrap_or_else(|| "-".to_string());
            audit_mysql_event(
                &state,
                id,
                "mysql_execute_query_failed",
                format!("execute query failed schema={schema_text}: {err}"),
                Some(command),
            )
            .await;
            Err(err)
        }
    }
}

pub async fn mysql_explain_query(
    state: State<'_, AppState>,
    id: String,
    sql: String,
) -> Result<MySqlQueryResult, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let trimmed_sql = sql.trim();
    let command = if trimmed_sql.is_empty() {
        "EXPLAIN".to_string()
    } else {
        format!("EXPLAIN {}", trimmed_sql.lines().next().unwrap_or(""))
            .chars()
            .take(220)
            .collect()
    };
    match state.mysql_explain_query(id, sql).await {
        Ok(result) => {
            audit_mysql_event(
                &state,
                id,
                "mysql_explain_query",
                format!("explain query rows={}", result.rows.len()),
                Some(command),
            )
            .await;
            Ok(result)
        }
        Err(err) => {
            audit_mysql_event(
                &state,
                id,
                "mysql_explain_query_failed",
                format!("explain query failed: {err}"),
                Some(command),
            )
            .await;
            Err(err)
        }
    }
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
    let command = format!(
        "ALTER TABLE `{}`.`{}` ADD COLUMN `{}` {}",
        schema, table, column_name, column_type
    );
    match state
        .mysql_alter_table_add_column(id, schema, table, column_name, column_type)
        .await
    {
        Ok(_) => {
            audit_mysql_event(&state, id, "mysql_alter_table_add_column", "alter table add column".to_string(), Some(command)).await;
            Ok(())
        }
        Err(err) => {
            audit_mysql_event(
                &state,
                id,
                "mysql_alter_table_add_column_failed",
                format!("alter table add column failed: {err}"),
                Some(command),
            )
            .await;
            Err(err)
        }
    }
}
