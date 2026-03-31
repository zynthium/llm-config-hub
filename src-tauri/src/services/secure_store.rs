use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use chrono::Utc;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use tauri::Manager;
use thiserror::Error;
use uuid::Uuid;

use crate::{
    templates::BuiltinTargetTemplate,
    types::{ExportTarget, ModelConfig, ModelHealthResult, NewExportTarget, NewModelConfig},
};

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("crypto error")]
    Crypto,
    #[error("keyring error: {0}")]
    Keyring(#[from] keyring::Error),
    #[error("not found")]
    NotFound,
}

impl serde::Serialize for StoreError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
struct StoreFile {
    model_configs: Vec<ModelConfig>,
    #[serde(default)]
    export_targets: Vec<ExportTarget>,
    #[serde(default)]
    model_health_cache: std::collections::HashMap<String, Vec<ModelHealthResult>>,
}

pub struct SecureStore {
    path: PathBuf,
    key: [u8; 32],
    state: Mutex<StoreFile>,
}

impl SecureStore {
    pub fn new(
        app: tauri::AppHandle,
        builtin_templates: Vec<BuiltinTargetTemplate>,
    ) -> Result<Self, StoreError> {
        let mut root = app.path().app_data_dir().map_err(|e| {
            log::debug!("[secure_store] app_data_dir error: {:?}", e);
            StoreError::Crypto
        })?;
        if !root.exists() {
            fs::create_dir_all(&root)?;
        }
        root.push("config_store.enc");
        let key = load_or_create_master_key().map_err(|e| {
            log::debug!("[secure_store] master_key error: {:?}", e);
            e
        })?;
        let mut state = if root.exists() {
            read_encrypted(&root, &key).map_err(|e| {
                log::debug!("[secure_store] read_encrypted error: {:?}", e);
                e
            })?
        } else {
            StoreFile::default()
        };
        sync_builtin_targets(&mut state.export_targets, &builtin_templates);
        write_encrypted(&root, &key, &state)?;
        Ok(Self {
            path: root,
            key,
            state: Mutex::new(state),
        })
    }

    // --- ModelConfig ---

    pub fn list_configs(&self) -> Vec<ModelConfig> {
        self.state
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .model_configs
            .clone()
    }

    pub fn get_config(&self, id: &str) -> Option<ModelConfig> {
        self.state
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .model_configs
            .iter()
            .find(|m| m.id == id)
            .cloned()
    }

    pub fn upsert_config(&self, input: NewModelConfig) -> Result<ModelConfig, StoreError> {
        let mut guard = self.state.lock().unwrap_or_else(|e| e.into_inner());
        let now = Utc::now();
        let mut saved = None;
        for config in &mut guard.model_configs {
            if let Some(id) = &input.id {
                if config.id == *id {
                    config.name = input.name.clone();
                    config.provider = input.provider.clone();
                    config.base_url = input.base_url.clone();
                    config.api_key = input.api_key.clone();
                    config.default_model = input.default_model.clone();
                    config.models = input.models.clone();
                    config.headers = input.headers.clone();
                    config.tags = input.tags.clone();
                    config.billing_type = input.billing_type.clone();
                    config.notes = input.notes.clone();
                    config.status = input.status.clone();
                    config.updated_at = now;
                    saved = Some(config.clone());
                    break;
                }
            }
        }
        let item = if let Some(existing) = saved {
            existing
        } else {
            let new_item = ModelConfig {
                id: Uuid::new_v4().to_string(),
                name: input.name,
                provider: input.provider,
                base_url: input.base_url,
                api_key: input.api_key,
                default_model: input.default_model,
                models: input.models,
                headers: input.headers,
                tags: input.tags,
                billing_type: input.billing_type,
                notes: input.notes,
                status: input.status,
                created_at: now,
                updated_at: now,
            };
            guard.model_configs.push(new_item.clone());
            new_item
        };
        write_encrypted(&self.path, &self.key, &guard)?;
        Ok(item)
    }

    pub fn delete_config(&self, id: &str) -> Result<(), StoreError> {
        let mut guard = self.state.lock().unwrap_or_else(|e| e.into_inner());
        let old_len = guard.model_configs.len();
        guard.model_configs.retain(|m| m.id != id);
        if old_len == guard.model_configs.len() {
            return Err(StoreError::NotFound);
        }
        write_encrypted(&self.path, &self.key, &guard)?;
        Ok(())
    }

    // --- ExportTarget ---

    pub fn list_targets(&self) -> Vec<ExportTarget> {
        self.state
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .export_targets
            .clone()
    }

    pub fn upsert_target(&self, input: NewExportTarget) -> Result<ExportTarget, StoreError> {
        let mut guard = self.state.lock().unwrap_or_else(|e| e.into_inner());
        // 拒绝编辑内置目标
        if let Some(id) = &input.id {
            if guard
                .export_targets
                .iter()
                .any(|t| &t.id == id && t.is_builtin)
            {
                return Err(StoreError::NotFound);
            }
        }
        let mut saved = None;
        for target in &mut guard.export_targets {
            if let Some(id) = &input.id {
                if target.id == *id {
                    target.name = input.name.clone();
                    target.is_remote = input.is_remote;
                    target.ssh_command = input.ssh_command.clone();
                    target.bash_script = input.bash_script.clone();
                    target.save_as_default_script = input.save_as_default_script.clone();
                    target.restore_default_script = input.restore_default_script.clone();
                    saved = Some(target.clone());
                    break;
                }
            }
        }
        let item = if let Some(existing) = saved {
            existing
        } else {
            let new_item = ExportTarget {
                id: input.id.unwrap_or_else(|| Uuid::new_v4().to_string()),
                name: input.name,
                is_remote: input.is_remote,
                ssh_command: input.ssh_command,
                bash_script: input.bash_script,
                save_as_default_script: input.save_as_default_script,
                restore_default_script: input.restore_default_script,
                is_builtin: false,
            };
            guard.export_targets.push(new_item.clone());
            new_item
        };
        write_encrypted(&self.path, &self.key, &guard)?;
        Ok(item)
    }

    pub fn delete_target(&self, id: &str) -> Result<(), StoreError> {
        let mut guard = self.state.lock().unwrap_or_else(|e| e.into_inner());
        // 拒绝删除内置目标
        if guard
            .export_targets
            .iter()
            .any(|t| t.id == id && t.is_builtin)
        {
            return Err(StoreError::NotFound);
        }
        let old_len = guard.export_targets.len();
        guard.export_targets.retain(|t| t.id != id);
        if old_len == guard.export_targets.len() {
            return Err(StoreError::NotFound);
        }
        write_encrypted(&self.path, &self.key, &guard)?;
        Ok(())
    }

    pub fn save_model_health_cache(
        &self,
        config_id: &str,
        results: Vec<ModelHealthResult>,
    ) -> Result<(), StoreError> {
        let mut guard = self.state.lock().unwrap_or_else(|e| e.into_inner());
        guard
            .model_health_cache
            .insert(config_id.to_string(), results);
        write_encrypted(&self.path, &self.key, &guard)?;
        Ok(())
    }

    pub fn load_model_health_cache(&self, config_id: &str) -> Option<Vec<ModelHealthResult>> {
        let guard = self.state.lock().unwrap_or_else(|e| e.into_inner());
        guard.model_health_cache.get(config_id).cloned()
    }

    pub fn remove_model_health_cache(&self, config_id: &str) -> Result<(), StoreError> {
        let mut guard = self.state.lock().unwrap_or_else(|e| e.into_inner());
        guard.model_health_cache.remove(config_id);
        write_encrypted(&self.path, &self.key, &guard)?;
        Ok(())
    }
}

fn sync_builtin_targets(
    export_targets: &mut Vec<ExportTarget>,
    builtin_templates: &[BuiltinTargetTemplate],
) {
    for template in builtin_templates {
        if let Some(existing) = export_targets
            .iter_mut()
            .find(|item| item.id == template.id)
        {
            existing.name = template.name.clone();
            existing.is_remote = template.is_remote;
            existing.bash_script = template.bash_script.clone();
            existing.save_as_default_script = Some(template.save_as_default_script.clone());
            existing.restore_default_script = Some(template.restore_default_script.clone());
            existing.is_builtin = true;
            continue;
        }

        export_targets.insert(
            0,
            ExportTarget {
                id: template.id.clone(),
                name: template.name.clone(),
                is_remote: template.is_remote,
                ssh_command: String::new(),
                bash_script: template.bash_script.clone(),
                save_as_default_script: Some(template.save_as_default_script.clone()),
                restore_default_script: Some(template.restore_default_script.clone()),
                is_builtin: true,
            },
        );
    }

    let builtin_order = builtin_templates
        .iter()
        .map(|template| (template.id.as_str(), template.order))
        .collect::<std::collections::HashMap<_, _>>();

    export_targets.sort_by(|a, b| {
        let a_pos = builtin_order.get(a.id.as_str()).copied();
        let b_pos = builtin_order.get(b.id.as_str()).copied();
        match (a_pos, b_pos) {
            (Some(ao), Some(bo)) => ao.cmp(&bo),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => std::cmp::Ordering::Equal,
        }
    });
}

fn load_or_create_master_key() -> Result<[u8; 32], StoreError> {
    let entry = keyring::Entry::new("llm-config-hub", "master-key")?;
    log::debug!("[keyring] entry created");
    let raw = match entry.get_password() {
        Ok(v) if !v.is_empty() => {
            log::debug!("[keyring] found existing key, len={}", v.len());
            v
        }
        Ok(_) | Err(_) => {
            log::debug!("[keyring] no valid key found, checking migration or generating new");
            // 尝试从旧 service name 迁移
            let migrated = keyring::Entry::new("ai-key-manager", "master-key")
                .ok()
                .and_then(|old_entry| old_entry.get_password().ok())
                .filter(|v| !v.is_empty());
            if let Some(old_val) = migrated {
                log::debug!("[keyring] migrating from ai-key-manager");
                entry.set_password(&old_val)?;
                let _ = keyring::Entry::new("ai-key-manager", "master-key")
                    .map(|e| e.delete_credential());
                old_val
            } else {
                log::debug!("[keyring] generating new master key");
                let mut key = [0u8; 32];
                rand::thread_rng().fill_bytes(&mut key);
                let encoded = BASE64.encode(key);
                entry.set_password(&encoded)?;
                encoded
            }
        }
    };
    let key_bytes = BASE64.decode(raw.trim()).map_err(|_| StoreError::Crypto)?;
    if key_bytes.len() != 32 {
        return Err(StoreError::Crypto);
    }
    let mut out = [0u8; 32];
    out.copy_from_slice(&key_bytes);
    Ok(out)
}

fn read_encrypted(path: &PathBuf, key: &[u8; 32]) -> Result<StoreFile, StoreError> {
    let content = fs::read_to_string(path)?;
    let mut parts = content.split('.');
    let nonce_b64 = parts.next().ok_or(StoreError::Crypto)?;
    let cipher_b64 = parts.next().ok_or(StoreError::Crypto)?;
    let nonce_bytes = BASE64.decode(nonce_b64).map_err(|_| StoreError::Crypto)?;
    let cipher_bytes = BASE64.decode(cipher_b64).map_err(|_| StoreError::Crypto)?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&nonce_bytes), cipher_bytes.as_ref())
        .map_err(|_| StoreError::Crypto)?;
    let store: StoreFile = serde_json::from_slice(&plaintext)?;
    Ok(store)
}

fn write_encrypted(path: &PathBuf, key: &[u8; 32], store: &StoreFile) -> Result<(), StoreError> {
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let plaintext = serde_json::to_vec(store)?;
    let encrypted = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), plaintext.as_ref())
        .map_err(|_| StoreError::Crypto)?;
    let data = format!(
        "{}.{}",
        BASE64.encode(nonce_bytes),
        BASE64.encode(encrypted)
    );
    let tmp_path = path.with_extension("enc.tmp");
    fs::write(&tmp_path, &data)?;
    fs::rename(&tmp_path, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::templates::loader::load_builtin_templates_from_dir;

    fn load_test_builtin_templates() -> Vec<BuiltinTargetTemplate> {
        load_builtin_templates_from_dir(
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/templates/builtin"),
        )
        .expect("builtin template resources should load")
    }

    #[test]
    fn builtin_targets_should_include_save_and_restore_scripts() {
        let mut export_targets = Vec::new();
        let builtin_templates = load_test_builtin_templates();
        sync_builtin_targets(&mut export_targets, &builtin_templates);

        assert!(
            export_targets
                .iter()
                .all(|target| target.save_as_default_script.is_some()),
            "all builtin targets should provide a save-as-default script"
        );
        assert!(
            export_targets
                .iter()
                .all(|target| target.restore_default_script.is_some()),
            "all builtin targets should provide a restore-default script"
        );
    }

    #[test]
    fn sync_builtin_targets_repairs_existing_builtin_targets() {
        let mut export_targets = vec![
            ExportTarget {
                id: "claude-code".to_string(),
                name: "Old Claude".to_string(),
                is_remote: true,
                ssh_command: "ssh stale".to_string(),
                bash_script: "echo stale".to_string(),
                save_as_default_script: None,
                restore_default_script: None,
                is_builtin: false,
            },
            ExportTarget {
                id: "custom-target".to_string(),
                name: "Custom".to_string(),
                is_remote: false,
                ssh_command: String::new(),
                bash_script: "echo custom".to_string(),
                save_as_default_script: Some("echo save".to_string()),
                restore_default_script: Some("echo restore".to_string()),
                is_builtin: false,
            },
        ];
        let builtin_templates = load_test_builtin_templates();

        sync_builtin_targets(&mut export_targets, &builtin_templates);

        let claude = export_targets
            .iter()
            .find(|target| target.id == "claude-code")
            .expect("claude-code builtin target should exist");
        assert_eq!(claude.name, "Claude Code");
        assert!(!claude.is_remote);
        assert!(claude.save_as_default_script.is_some());
        assert!(claude.restore_default_script.is_some());
        assert!(claude.is_builtin);

        let custom = export_targets
            .iter()
            .find(|target| target.id == "custom-target")
            .expect("custom target should be preserved");
        assert_eq!(custom.name, "Custom");
        assert_eq!(custom.save_as_default_script.as_deref(), Some("echo save"));
        assert_eq!(
            custom.restore_default_script.as_deref(),
            Some("echo restore")
        );
    }
}
