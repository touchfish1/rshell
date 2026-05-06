use tauri::State;
use uuid::Uuid;

use super::audit::audit_postgresql_event;
use crate::app::AppState;
use crate::domain::postgresql::{PostgreSqlConnection, PostgreSqlConnectionInput};

pub async fn list_postgresql_connections(
    state: State<'_, AppState>,
) -> Result<Vec<PostgreSqlConnection>, String> {
    Ok(state.list_postgresql_connections().await)
}

pub async fn create_postgresql_connection(
    state: State<'_, AppState>,
    input: PostgreSqlConnectionInput,
    secret: Option<String>,
) -> Result<PostgreSqlConnection, String> {
    state.create_postgresql_connection(input, secret).await
}

pub async fn update_postgresql_connection(
    state: State<'_, AppState>,
    id: String,
    input: PostgreSqlConnectionInput,
    secret: Option<String>,
) -> Result<PostgreSqlConnection, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.update_postgresql_connection(id, input, secret).await
}

pub async fn delete_postgresql_connection(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.delete_postgresql_connection(id).await
}

pub async fn get_postgresql_secret(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<String>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.get_postgresql_secret(id).await
}

pub async fn connect_postgresql(
    state: State<'_, AppState>,
    id: String,
    secret: Option<String>,
) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    match state.connect_postgresql(id, secret).await {
        Ok(_) => {
            audit_postgresql_event(
                &state,
                id,
                "postgresql_connect",
                "postgresql connected".to_string(),
                Some("CONNECT".to_string()),
            )
            .await;
            Ok(())
        }
        Err(err) => {
            audit_postgresql_event(
                &state,
                id,
                "postgresql_connect_failed",
                format!("postgresql connect failed: {err}"),
                Some("CONNECT".to_string()),
            )
            .await;
            Err(err)
        }
    }
}

pub async fn test_postgresql_connection(
    host: String,
    port: Option<u16>,
    username: String,
    database: Option<String>,
    secret: Option<String>,
) -> Result<(), String> {
    let tmp = crate::domain::postgresql::PostgreSqlConnectionInput {
        name: "tmp".to_string(),
        host,
        port,
        username,
        database,
    }
    .into_connection();
    let mut url = format!("postgres://{}:", tmp.username);
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
    let pool = sqlx::PgPool::connect(&url)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("SELECT 1")
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn disconnect_postgresql(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    match state.disconnect_postgresql(id).await {
        Ok(_) => {
            audit_postgresql_event(
                &state,
                id,
                "postgresql_disconnect",
                "postgresql disconnected".to_string(),
                Some("DISCONNECT".to_string()),
            )
            .await;
            Ok(())
        }
        Err(err) => {
            audit_postgresql_event(
                &state,
                id,
                "postgresql_disconnect_failed",
                format!("postgresql disconnect failed: {err}"),
                Some("DISCONNECT".to_string()),
            )
            .await;
            Err(err)
        }
    }
}
