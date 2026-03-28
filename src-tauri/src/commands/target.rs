use tauri::State;

use crate::services::secure_store::SecureStore;
use crate::types::{ExportTarget, NewExportTarget};

#[tauri::command]
pub fn list_targets(store: State<'_, SecureStore>) -> Vec<ExportTarget> {
    store.list_targets()
}

#[tauri::command]
pub fn upsert_target(
    store: State<'_, SecureStore>,
    target: NewExportTarget,
) -> Result<ExportTarget, String> {
    store.upsert_target(target).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_target(store: State<'_, SecureStore>, id: String) -> Result<(), String> {
    store.delete_target(&id).map_err(|e| e.to_string())
}
