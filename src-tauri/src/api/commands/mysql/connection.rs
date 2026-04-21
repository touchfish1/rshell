use tauri::State;
use uuid::Uuid;

use crate::app::AppState;
use crate::domain::mysql::{MySqlConnection, MySqlConnectionInput};
use super::audit::audit_mysql_event;

pub async fn list_mysql_connections(state: State<'_, AppState>) -> Result<Vec<MySqlConnection>, String> {
    Ok(state.list_mysql_connections().await)
}

pub async fn create_mysql_connection(
    state: State<'_, AppState>,
    input: MySqlConnectionInput,
    secret: Option<String>,
) -> Result<MySqlConnection, String> {
    state.create_mysql_connection(input, secret).await
}

pub async fn update_mysql_connection(
    state: State<'_, AppState>,
    id: String,
    input: MySqlConnectionInput,
    secret: Option<String>,
) -> Result<MySqlConnection, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.update_mysql_connection(id, input, secret).await
}

pub async fn delete_mysql_connection(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.delete_mysql_connection(id).await
}

pub async fn get_mysql_secret(state: State<'_, AppState>, id: String) -> Result<Option<String>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.get_mysql_secret(id).await
}

pub async fn connect_mysql(
    state: State<'_, AppState>,
    id: String,
    secret: Option<String>,
) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    match state.connect_mysql(id, secret).await {
        Ok(_) => {
            audit_mysql_event(
                &state,
                id,
                "mysql_connect",
                "mysql connected".to_string(),
                Some("CONNECT".to_string()),
            )
            .await;
            Ok(())
        }
        Err(err) => {
            audit_mysql_event(
                &state,
                id,
                "mysql_connect_failed",
                format!("mysql connect failed: {err}"),
                Some("CONNECT".to_string()),
            )
            .await;
            Err(err)
        }
    }
}

pub async fn test_mysql_connection(
    host: String,
    port: Option<u16>,
    username: String,
    database: Option<String>,
    secret: Option<String>,
) -> Result<(), String> {
    let tmp = crate::domain::mysql::MySqlConnectionInput {
        name: "tmp".to_string(),
        host,
        port,
        username,
        database,
    }
    .into_connection();
    let mut url = format!("mysql://{}:", tmp.username);
    url.push_str(&urlencoding::encode(secret.as_deref().unwrap_or("")));
    url.push('@');
    url.push_str(&tmp.host);
    url.push(':');
    url.push_str(&tmp.port.to_string());
    if let Some(db) = &tmp.database {
        if !db.trim().is_empty() {
            url.push('/');
            url.push_str(db.trim());
        }
    }
    let pool = sqlx::MySqlPool::connect(&url)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("SELECT 1")
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn disconnect_mysql(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    match state.disconnect_mysql(id).await {
        Ok(_) => {
            audit_mysql_event(
                &state,
                id,
                "mysql_disconnect",
                "mysql disconnected".to_string(),
                Some("DISCONNECT".to_string()),
            )
            .await;
            Ok(())
        }
        Err(err) => {
            audit_mysql_event(
                &state,
                id,
                "mysql_disconnect_failed",
                format!("mysql disconnect failed: {err}"),
                Some("DISCONNECT".to_string()),
            )
            .await;
            Err(err)
        }
    }
}
