mod commands;
mod services;
mod types;

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            let secure_store = services::secure_store::SecureStore::new(app.handle().clone())?;
            app.manage(secure_store);

            let show = MenuItemBuilder::with_id("show", "显示").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "退出").build(app)?;
            let menu = MenuBuilder::new(app).items(&[&show, &quit]).build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("LLM Config Hub")
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.unminimize();
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.unminimize();
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    window.hide().unwrap();
                    api.prevent_close();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::model::list_model_configs,
            commands::model::upsert_model_config,
            commands::model::delete_model_config,
            commands::clipboard::parse_clipboard_text,
            commands::health::test_connection,
            commands::health::check_config_health,
            commands::health::check_all_health,
            commands::health::check_config_models_health,
            commands::health::probe_models_adhoc,
            commands::health::save_model_health_cache,
            commands::health::load_model_health_cache,
            commands::health::remove_model_health_cache,
            commands::import::detect_local_targets,
            commands::import::import_to_local_target,
            commands::import::import_to_ssh_target,
            commands::target::list_targets,
            commands::target::upsert_target,
            commands::target::delete_target,
            commands::shell::run_bash_script,
            commands::shell::close_splashscreen
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
