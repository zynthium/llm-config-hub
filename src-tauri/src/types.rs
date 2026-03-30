use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfig {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub base_url: String,
    pub api_key: String,
    pub default_model: Option<String>,
    pub models: Option<String>,
    pub headers: Option<serde_json::Value>,
    pub tags: Option<Vec<String>>,
    pub billing_type: Option<String>,
    pub notes: Option<String>,
    pub status: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewModelConfig {
    pub id: Option<String>,
    pub name: String,
    pub provider: String,
    pub base_url: String,
    pub api_key: String,
    pub default_model: Option<String>,
    pub models: Option<String>,
    pub headers: Option<serde_json::Value>,
    pub tags: Option<Vec<String>>,
    pub billing_type: Option<String>,
    pub notes: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportTarget {
    pub id: String,
    pub name: String,
    pub is_remote: bool,
    pub ssh_command: String,
    pub bash_script: String,
    pub save_as_default_script: Option<String>,
    pub restore_default_script: Option<String>,
    #[serde(default)]
    pub is_builtin: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewExportTarget {
    pub id: Option<String>,
    pub name: String,
    pub is_remote: bool,
    pub ssh_command: String,
    pub bash_script: String,
    pub save_as_default_script: Option<String>,
    pub restore_default_script: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalImportTarget {
    pub editor: String,
    pub path: String,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshImportInput {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub private_key_path: String,
    pub editor: String,
    pub remote_path: Option<String>,
    pub config_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedClipboard {
    pub provider: Option<String>,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub default_model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthCheckResult {
    pub config_id: String,
    pub status: String,
    pub latency_ms: u128,
    pub error_type: Option<String>,
    pub checked_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelHealthResult {
    pub config_id: String,
    pub model: String,
    pub status: String,
    pub latency_ms: u128,
    pub error_type: Option<String>,
    pub checked_at: DateTime<Utc>,
}
