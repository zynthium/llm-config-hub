use tauri::State;

use crate::services::secure_store::{SecureStore, StoreError};
use crate::types::{ModelConfig, NewModelConfig};

#[tauri::command]
pub fn list_model_configs(store: State<'_, SecureStore>) -> Vec<ModelConfig> {
    store.list_configs()
}

#[tauri::command]
pub fn upsert_model_config(
    store: State<'_, SecureStore>,
    input: NewModelConfig,
) -> Result<ModelConfig, StoreError> {
    store.upsert_config(input)
}

#[tauri::command]
pub fn delete_model_config(store: State<'_, SecureStore>, id: String) -> Result<(), StoreError> {
    store.delete_config(&id)
}

