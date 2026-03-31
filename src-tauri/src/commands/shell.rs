use std::process::Command;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn run_bash_script(script: String) -> Result<String, String> {
    let trimmed = script.trim();
    if trimmed.is_empty() {
        return Err("script is empty".to_string());
    }
    log::info!("[shell] executing script ({} bytes)", trimmed.len());

    let output = Command::new("bash")
        .arg("-c")
        .arg(&script)
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(if stdout.is_empty() { stderr } else { stdout })
    } else {
        Err(if stderr.is_empty() { stdout } else { stderr })
    }
}

#[tauri::command]
pub fn close_splashscreen(app: AppHandle) {
    if let Some(splash) = app.get_webview_window("splashscreen") {
        splash.close().ok();
    }
    if let Some(main) = app.get_webview_window("main") {
        main.show().ok();
        main.set_focus().ok();
    }
}
