//! rshell 桌面端（Tauri）Rust 入口。
//!
//! 负责注册插件、全局 `AppState`，以及暴露给前端的全部 `tauri::command`。
//! Release 构建在 Windows 上使用 GUI 子系统，避免额外弹出控制台窗口。

#![cfg_attr(all(windows, not(debug_assertions)), windows_subsystem = "windows")]

mod api;
mod app;
mod domain;
mod infra;

use app::AppState;
use tauri::{Manager, WindowEvent};

fn main() {
    tauri::Builder::default()
        // 子进程控制（如退出应用）
        .plugin(tauri_plugin_process::init())
        // 内置在线更新
        .plugin(tauri_plugin_updater::Builder::new().build())
        // 记住窗口位置与尺寸
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(AppState::default())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let handle = app.handle().clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        if let Some(w) = handle.get_webview_window("main") {
                            let _ = w.hide();
                        }
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            api::commands::list_sessions,
            api::commands::create_session,
            api::commands::update_session,
            api::commands::delete_session,
            api::commands::has_session_secret,
            api::commands::get_session_secret,
            api::commands::connect_session,
            api::commands::pull_output,
            api::commands::disconnect_session,
            api::commands::send_input,
            api::commands::resize_terminal,
            api::commands::list_sftp_dir,
            api::commands::download_sftp_file,
            api::commands::read_sftp_text_file,
            api::commands::save_sftp_text_file,
            api::commands::upload_sftp_file,
            api::commands::test_host_reachability,
            api::commands::open_in_file_manager,
            api::commands::open_external_url,
            api::commands::get_host_metrics,
            api::commands::list_audits,
            api::commands::list_zookeeper_connections,
            api::commands::create_zookeeper_connection,
            api::commands::update_zookeeper_connection,
            api::commands::delete_zookeeper_connection,
            api::commands::has_zookeeper_secret,
            api::commands::get_zookeeper_secret,
            api::commands::connect_zookeeper,
            api::commands::test_zookeeper_connection,
            api::commands::disconnect_zookeeper,
            api::commands::zk_list_children,
            api::commands::zk_get_data,
            api::commands::zk_set_data,
            api::commands::list_redis_connections,
            api::commands::create_redis_connection,
            api::commands::update_redis_connection,
            api::commands::delete_redis_connection,
            api::commands::get_redis_secret,
            api::commands::connect_redis,
            api::commands::test_redis_connection,
            api::commands::disconnect_redis,
            api::commands::redis_list_keys,
            api::commands::redis_scan_keys,
            api::commands::redis_list_databases,
            api::commands::redis_get_value,
            api::commands::redis_set_value,
            api::commands::redis_get_key_data,
            api::commands::redis_set_key_data,
            api::commands::redis_set_ttl,
            api::commands::list_mysql_connections,
            api::commands::create_mysql_connection,
            api::commands::update_mysql_connection,
            api::commands::delete_mysql_connection,
            api::commands::get_mysql_secret,
            api::commands::connect_mysql,
            api::commands::test_mysql_connection,
            api::commands::disconnect_mysql,
            api::commands::mysql_list_databases,
            api::commands::mysql_list_tables,
            api::commands::mysql_list_columns,
            api::commands::mysql_execute_query,
            api::commands::mysql_explain_query,
            api::commands::mysql_alter_table_add_column,
            api::commands::list_environments,
            api::commands::get_current_environment,
            api::commands::create_environment,
            api::commands::rename_current_environment,
            api::commands::switch_environment,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run rshell");
}
