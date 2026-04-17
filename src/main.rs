mod api;
mod app;
mod domain;
mod infra;

use app::AppState;

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            api::commands::list_sessions,
            api::commands::create_session,
            api::commands::update_session,
            api::commands::delete_session,
            api::commands::has_session_secret,
            api::commands::connect_session,
            api::commands::pull_output,
            api::commands::disconnect_session,
            api::commands::send_input,
            api::commands::resize_terminal,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run rshell");
}
