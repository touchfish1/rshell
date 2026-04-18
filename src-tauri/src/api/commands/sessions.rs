//! 会话 CRUD 与密钥是否存在、读取密码（供前端编辑会话时回填）。

use tauri::State;
use uuid::Uuid;

use crate::app::AppState;
use crate::domain::session::{Session, SessionInput};

pub async fn list_sessions(state: State<'_, AppState>) -> Result<Vec<Session>, String> {
    Ok(state.list_sessions().await)
}

pub async fn create_session(
    state: State<'_, AppState>,
    input: SessionInput,
    secret: Option<String>,
) -> Result<Session, String> {
    state.create_session(input, secret).await
}

pub async fn update_session(
    state: State<'_, AppState>,
    id: String,
    input: SessionInput,
    secret: Option<String>,
) -> Result<Session, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.update_session(id, input, secret).await
}

pub async fn delete_session(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.delete_session(id).await
}

pub async fn has_session_secret(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.has_secret(id).await
}

pub async fn get_session_secret(state: State<'_, AppState>, id: String) -> Result<Option<String>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.get_secret(id).await
}

