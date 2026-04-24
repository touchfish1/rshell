use tauri::State;

use crate::app::AppState;

pub async fn list_environments(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    Ok(state.list_environments().await)
}

pub async fn get_current_environment(state: State<'_, AppState>) -> Result<String, String> {
    Ok(state.get_current_environment().await)
}

pub async fn create_environment(state: State<'_, AppState>, name: String) -> Result<Vec<String>, String> {
    state.create_environment(name).await
}

pub async fn rename_current_environment(
    state: State<'_, AppState>,
    new_name: String,
) -> Result<String, String> {
    state.rename_current_environment(new_name).await
}

pub async fn switch_environment(state: State<'_, AppState>, name: String) -> Result<String, String> {
    state.switch_environment(name).await
}
