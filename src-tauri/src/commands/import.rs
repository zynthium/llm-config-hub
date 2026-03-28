use tauri::State;

use crate::services::importers::{detect_targets, import_to_local};
use crate::services::secure_store::SecureStore;
use crate::services::ssh_client::import_via_ssh;
use crate::types::{LocalImportTarget, SshImportInput};

#[tauri::command]
pub fn detect_local_targets() -> Vec<LocalImportTarget> {
    detect_targets()
}

#[tauri::command]
pub fn import_to_local_target(
    store: State<'_, SecureStore>,
    config_id: String,
    target: LocalImportTarget,
) -> Result<(), String> {
    let config = store
        .get_config(&config_id)
        .ok_or("config not found".to_string())?;
    import_to_local(&target, &config)
}

#[tauri::command]
pub fn import_to_ssh_target(
    store: State<'_, SecureStore>,
    input: SshImportInput,
) -> Result<(), String> {
    let config = store
        .get_config(&input.config_id)
        .ok_or("config not found".to_string())?;
    let payload = serde_json::to_string_pretty(&serde_json::json!({
      "provider": config.provider,
      "name": config.name,
      "baseUrl": config.base_url,
      "apiKey": config.api_key,
      "model": config.default_model,
      "headers": config.headers
    }))
    .map_err(|e| e.to_string())?;
    import_via_ssh(&input, &payload)
}

