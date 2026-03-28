use chrono::Utc;
use tauri::State;

use crate::services::health_check::{check_config, check_models_for_config};
use crate::services::secure_store::SecureStore;
use crate::types::{HealthCheckResult, ModelConfig, ModelHealthResult};

#[tauri::command]
pub async fn test_connection(
    provider: String,
    #[allow(non_snake_case)] baseUrl: String,
    #[allow(non_snake_case)] apiKey: String,
    models: Option<String>,
) -> Result<HealthCheckResult, String> {
    let config = ModelConfig {
        id: "_test".to_string(),
        name: String::new(),
        provider,
        base_url: baseUrl,
        api_key: apiKey,
        default_model: models.as_ref().and_then(|m| m.split(',').next().map(|s| s.trim().to_string())),
        models,
        headers: None,
        tags: None,
        billing_type: None,
        status: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    Ok(check_config(&config).await)
}

#[tauri::command]
pub async fn check_config_health(
    store: State<'_, SecureStore>,
    config_id: String,
) -> Result<HealthCheckResult, String> {
    let config = store
        .get_config(&config_id)
        .ok_or("config not found".to_string())?;
    Ok(check_config(&config).await)
}

#[tauri::command]
pub async fn check_all_health(
    store: State<'_, SecureStore>,
) -> Result<Vec<HealthCheckResult>, String> {
    let configs = store.list_configs();
    let mut out = Vec::with_capacity(configs.len());
    for cfg in configs {
        out.push(check_config(&cfg).await);
    }
    Ok(out)
}

#[tauri::command]
pub async fn check_config_models_health(
    store: State<'_, SecureStore>,
    config_id: String,
) -> Result<Vec<ModelHealthResult>, String> {
    let config = store
        .get_config(&config_id)
        .ok_or("config not found".to_string())?;
    Ok(check_models_for_config(&config).await)
}

#[tauri::command]
pub async fn probe_models_adhoc(
    provider: String,
    #[allow(non_snake_case)] baseUrl: String,
    #[allow(non_snake_case)] apiKey: String,
    models: Option<String>,
) -> Result<Vec<ModelHealthResult>, String> {
    let config = ModelConfig {
        id: "_adhoc".to_string(),
        name: String::new(),
        provider,
        base_url: baseUrl,
        api_key: apiKey,
        default_model: models.as_ref().and_then(|m| m.split(',').next().map(|s| s.trim().to_string())),
        models,
        headers: None,
        tags: None,
        billing_type: None,
        status: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    Ok(check_models_for_config(&config).await)
}

#[tauri::command]
pub fn save_model_health_cache(
    store: State<'_, SecureStore>,
    config_id: String,
    results: Vec<ModelHealthResult>,
) -> Result<(), String> {
    store.save_model_health_cache(&config_id, results).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_model_health_cache(
    store: State<'_, SecureStore>,
    config_id: String,
) -> Option<Vec<ModelHealthResult>> {
    store.load_model_health_cache(&config_id)
}

#[tauri::command]
pub fn remove_model_health_cache(
    store: State<'_, SecureStore>,
    config_id: String,
) -> Result<(), String> {
    store.remove_model_health_cache(&config_id).map_err(|e| e.to_string())
}

