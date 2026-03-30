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

use crate::types::{ExportTarget, ModelConfig, ModelHealthResult, NewExportTarget, NewModelConfig};

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

const DEFAULT_TARGETS: &[(&str, &str, bool, &str)] = &[
    (
        "claude-code",
        "Claude Code",
        false,
        r#"#!/usr/bin/env bash
set -euo pipefail
CONFIG="$HOME/.claude/settings.json"
CONFIG_DIR="$(dirname "$CONFIG")"
BAK_PREFIX="settings.bak."
mkdir -p "$CONFIG_DIR"

# 备份函数：仅当不存在内容相同的备份时才创建新备份
do_backup() {
  local src="$1" dir="$2" prefix="$3"
  local src_hash
  src_hash="$(shasum -a 256 "$src" 2>/dev/null | awk '{print $1}' || md5sum "$src" 2>/dev/null | awk '{print $1}')"
  for bak in "$dir/${prefix}"*; do
    [ -f "$bak" ] || continue
    local bak_hash
    bak_hash="$(shasum -a 256 "$bak" 2>/dev/null | awk '{print $1}' || md5sum "$bak" 2>/dev/null | awk '{print $1}')"
    [ "$src_hash" = "$bak_hash" ] && return 0
  done
  local dst="$dir/${prefix}$(date +%s)"
  cp "$src" "$dst"
  echo "已备份至: $dst"
}

if [ -f "$CONFIG" ]; then
  do_backup "$CONFIG" "$CONFIG_DIR" "$BAK_PREFIX"
fi

# 保留已有字段，仅覆盖 env 中的 API 相关字段
if command -v python3 &>/dev/null; then
  python3 - <<'PYEOF'
import json, os
p = os.path.expanduser('~/.claude/settings.json')
data = {}
if os.path.exists(p):
    try:
        with open(p, encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        pass
env = data.setdefault('env', {})
default_model = "{{defaultModel}}".strip()
env['ANTHROPIC_AUTH_TOKEN'] = '{{apiKey}}'
env['ANTHROPIC_BASE_URL'] = '{{baseUrl}}'
env['CLAUDE_CODE_MAX_OUTPUT_TOKENS'] = '32000'
env['CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'] = '1'
if default_model:
    env['ANTHROPIC_DEFAULT_HAIKU_MODEL'] = default_model
    env['ANTHROPIC_DEFAULT_SONNET_MODEL'] = default_model
    env['ANTHROPIC_DEFAULT_OPUS_MODEL'] = default_model
    env['ANTHROPIC_MODEL'] = default_model
with open(p, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
PYEOF
else
  DEFAULT_MODEL="{{defaultModel}}"
  if [ -n "${DEFAULT_MODEL}" ]; then
    echo '{"env":{"ANTHROPIC_AUTH_TOKEN":"{{apiKey}}","ANTHROPIC_BASE_URL":"{{baseUrl}}","ANTHROPIC_DEFAULT_HAIKU_MODEL":"{{defaultModel}}","ANTHROPIC_DEFAULT_SONNET_MODEL":"{{defaultModel}}","ANTHROPIC_DEFAULT_OPUS_MODEL":"{{defaultModel}}","ANTHROPIC_MODEL":"{{defaultModel}}","CLAUDE_CODE_MAX_OUTPUT_TOKENS":"32000","CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC":"1"}}' > "$CONFIG"
  else
    echo '{"env":{"ANTHROPIC_AUTH_TOKEN":"{{apiKey}}","ANTHROPIC_BASE_URL":"{{baseUrl}}","CLAUDE_CODE_MAX_OUTPUT_TOKENS":"32000","CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC":"1"}}' > "$CONFIG"
  fi
fi
echo "Claude Code 配置已更新: $CONFIG""#,
    ),
    (
        "cursor",
        "Cursor",
        false,
        r#"#!/usr/bin/env bash
set -euo pipefail
# Cursor 不支持通过配置文件设置自定义 API BaseURL
# 官方仅支持在 Cursor Settings -> Models 界面手动填写 API Key
# 此脚本将 API Key 写入环境变量供参考，并打印操作指引
SHELL_RC="$HOME/.zshrc"
[ -f "$HOME/.bashrc" ] && SHELL_RC="$HOME/.bashrc"

# 移除旧条目避免重复
if [ -f "$SHELL_RC" ]; then
  sed -i.bak '/# cursor api override/d' "$SHELL_RC"
  sed -i.bak '/export OPENAI_API_KEY=.*cursor/d' "$SHELL_RC"
  sed -i.bak '/export ANTHROPIC_API_KEY=.*cursor/d' "$SHELL_RC"
fi

echo ''
echo '========================================'
echo 'Cursor 不支持通过配置文件设置自定义 BaseURL'
echo '请手动在 Cursor 中完成以下配置：'
echo '  1. 打开 Cursor -> Settings -> Models'
echo '  2. 在 OpenAI API Key 处填写你的 API Key：{{apiKey}}'
echo '  3. 若使用 Azure/Bedrock，在对应区域填写 Endpoint'
echo '  4. 自定义 BaseURL 需使用 OpenAI-compatible 代理'
echo '========================================'
echo ''
echo "你的 API Key: {{apiKey}}"
echo "你的 BaseURL:  {{baseUrl}} （需在代理层配置，Cursor 不支持直接设置）""#,
    ),
    (
        "codex",
        "Codex CLI",
        false,
        r#"#!/usr/bin/env bash
set -euo pipefail
CODEX_DIR="$HOME/.codex"
CONFIG="$CODEX_DIR/config.toml"
AUTH="$CODEX_DIR/auth.json"
mkdir -p "$CODEX_DIR"

# 备份函数：仅当不存在内容相同的备份时才创建新备份
do_backup() {
  local src="$1" dir="$2" prefix="$3"
  local src_hash
  src_hash="$(shasum -a 256 "$src" 2>/dev/null | awk '{print $1}' || md5sum "$src" 2>/dev/null | awk '{print $1}')"
  for bak in "$dir/${prefix}"*; do
    [ -f "$bak" ] || continue
    local bak_hash
    bak_hash="$(shasum -a 256 "$bak" 2>/dev/null | awk '{print $1}' || md5sum "$bak" 2>/dev/null | awk '{print $1}')"
    [ "$src_hash" = "$bak_hash" ] && return 0
  done
  local dst="$dir/${prefix}$(date +%s)"
  cp "$src" "$dst"
  echo "已备份至: $dst"
}

[ -f "$CONFIG" ] && do_backup "$CONFIG" "$CODEX_DIR" "config.toml.bak."
[ -f "$AUTH" ] && do_backup "$AUTH" "$CODEX_DIR" "auth.json.bak."

# 写入 config.toml
cat > "$CONFIG" <<EOF
model_provider = "custom"
model = "{{defaultModel}}"
model_reasoning_effort = "high"
network_access = "enabled"
disable_response_storage = true

[model_providers.custom]
name = "custom"
base_url = "{{baseUrl}}"
wire_api = "responses"
requires_openai_auth = true
EOF

# 写入 auth.json
cat > "$AUTH" <<EOF
{
  "OPENAI_API_KEY": "{{apiKey}}"
}
EOF

echo "Codex CLI 配置已更新:"
echo "  $CONFIG"
echo "  $AUTH""#,
    ),
    (
        "gemini-cli",
        "Gemini CLI",
        false,
        r#"#!/usr/bin/env bash
set -euo pipefail

# Gemini CLI 通过环境变量 GEMINI_API_KEY 认证，不支持自定义 baseURL
# 根据用户默认 shell 选择 profile 文件
USER_SHELL="$(basename "${SHELL:-/bin/bash}")"
SHELL_RC="$HOME/.profile"
case "$USER_SHELL" in
  zsh)  SHELL_RC="$HOME/.zshrc" ;;
  bash) SHELL_RC="$HOME/.bashrc" ;;
  fish) SHELL_RC="$HOME/.config/fish/config.fish" ;;
esac

BAK_PREFIX="$(basename "$SHELL_RC").gemini.bak."
BAK_DIR="$(dirname "$SHELL_RC")"

# 备份函数：仅当不存在内容相同的备份时才创建新备份
do_backup() {
  local src="$1" dir="$2" prefix="$3"
  [ -f "$src" ] || return 0
  local src_hash
  src_hash="$(shasum -a 256 "$src" 2>/dev/null | awk '{print $1}' || md5sum "$src" 2>/dev/null | awk '{print $1}')"
  for bak in "$dir/${prefix}"*; do
    [ -f "$bak" ] || continue
    local bak_hash
    bak_hash="$(shasum -a 256 "$bak" 2>/dev/null | awk '{print $1}' || md5sum "$bak" 2>/dev/null | awk '{print $1}')"
    [ "$src_hash" = "$bak_hash" ] && return 0
  done
  local dst="$dir/${prefix}$(date +%s)"
  cp "$src" "$dst"
  echo "已备份至: $dst"
}

do_backup "$SHELL_RC" "$BAK_DIR" "$BAK_PREFIX"

# 移除旧的 GEMINI_API_KEY 设置
if [ -f "$SHELL_RC" ]; then
  sed -i.tmp '/# gemini-cli GEMINI_API_KEY/d' "$SHELL_RC"
  sed -i.tmp '/export GEMINI_API_KEY=/d' "$SHELL_RC"
  rm -f "${SHELL_RC}.tmp"
fi

# 写入新的 GEMINI_API_KEY
echo '# gemini-cli GEMINI_API_KEY' >> "$SHELL_RC"
echo 'export GEMINI_API_KEY="{{apiKey}}"' >> "$SHELL_RC"

echo "Gemini CLI 配置已更新: $SHELL_RC"
echo "请重新加载 shell 或运行: source $SHELL_RC""#,
    ),
    (
        "opencode",
        "Opencode",
        false,
        r#"#!/usr/bin/env bash
set -euo pipefail
CONFIG="$HOME/.config/opencode/opencode.json"
CONFIG_DIR="$(dirname "$CONFIG")"
BAK_PREFIX="opencode.bak."
mkdir -p "$CONFIG_DIR"

# 备份函数：仅当不存在内容相同的备份时才创建新备份
do_backup() {
  local src="$1" dir="$2" prefix="$3"
  local src_hash
  src_hash="$(shasum -a 256 "$src" 2>/dev/null | awk '{print $1}' || md5sum "$src" 2>/dev/null | awk '{print $1}')"
  for bak in "$dir/${prefix}"*; do
    [ -f "$bak" ] || continue
    local bak_hash
    bak_hash="$(shasum -a 256 "$bak" 2>/dev/null | awk '{print $1}' || md5sum "$bak" 2>/dev/null | awk '{print $1}')"
    [ "$src_hash" = "$bak_hash" ] && return 0
  done
  local dst="$dir/${prefix}$(date +%s)"
  cp "$src" "$dst"
  echo "已备份至: $dst"
}

if [ -f "$CONFIG" ]; then
  do_backup "$CONFIG" "$CONFIG_DIR" "$BAK_PREFIX"
fi

cat > "$CONFIG" <<EOF
{
  "$schema": "https://opencode.ai/config.json",
  "model": "custom/{{defaultModel}}",
  "provider": {
    "custom": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Custom",
      "options": {
        "baseURL": "{{baseUrl}}",
        "apiKey": "{{apiKey}}"
      },
      "models": {
        "{{defaultModel}}": {
          "name": "{{defaultModel}}"
        }
      }
    }
  }
}
EOF
echo "Opencode 配置已更新: $CONFIG""#,
    ),
];

impl SecureStore {
    pub fn new(app: tauri::AppHandle) -> Result<Self, StoreError> {
        let mut root = app.path().app_data_dir().map_err(|e| {
            eprintln!("[secure_store] app_data_dir error: {:?}", e);
            StoreError::Crypto
        })?;
        if !root.exists() {
            fs::create_dir_all(&root)?;
        }
        root.push("config_store.enc");
        let key = load_or_create_master_key().map_err(|e| {
            eprintln!("[secure_store] master_key error: {:?}", e);
            e
        })?;
        let mut state = if root.exists() {
            read_encrypted(&root, &key).map_err(|e| {
                eprintln!("[secure_store] read_encrypted error: {:?}", e);
                e
            })?
        } else {
            StoreFile::default()
        };
        let _builtin_ids: Vec<&str> = DEFAULT_TARGETS.iter().map(|(id, _, _, _)| *id).collect();
        // 确保所有内置目标都存在（兼容旧数据）
        for (id, name, is_remote, script) in DEFAULT_TARGETS {
            if !state.export_targets.iter().any(|t| t.id == *id) {
                state.export_targets.insert(
                    0,
                    ExportTarget {
                        id: id.to_string(),
                        name: name.to_string(),
                        is_remote: *is_remote,
                        ssh_command: String::new(),
                        bash_script: script.to_string(),
                        save_as_default_script: None,
                        restore_default_script: None,
                        is_builtin: true,
                    },
                );
            } else {
                // 强制同步内置目标的脚本和名称，确保版本更新后脚本随之更新
                for t in &mut state.export_targets {
                    if t.id == *id {
                        t.bash_script = script.to_string();
                        t.name = name.to_string();
                        t.is_builtin = true;
                    }
                }
            }
        }
        // 按指定顺序重新排序内置目标
        let target_order = ["claude-code", "codex", "gemini-cli", "opencode", "cursor"];
        state.export_targets.sort_by(|a, b| {
            let a_pos = target_order.iter().position(|&x| x == a.id);
            let b_pos = target_order.iter().position(|&x| x == b.id);
            match (a_pos, b_pos) {
                (Some(ao), Some(bo)) => ao.cmp(&bo),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => std::cmp::Ordering::Equal,
            }
        });
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
            .expect("store lock poisoned")
            .model_configs
            .clone()
    }

    pub fn get_config(&self, id: &str) -> Option<ModelConfig> {
        self.state
            .lock()
            .expect("store lock poisoned")
            .model_configs
            .iter()
            .find(|m| m.id == id)
            .cloned()
    }

    pub fn upsert_config(&self, input: NewModelConfig) -> Result<ModelConfig, StoreError> {
        let mut guard = self.state.lock().expect("store lock poisoned");
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
        let mut guard = self.state.lock().expect("store lock poisoned");
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
            .expect("store lock poisoned")
            .export_targets
            .clone()
    }

    pub fn upsert_target(&self, input: NewExportTarget) -> Result<ExportTarget, StoreError> {
        let mut guard = self.state.lock().expect("store lock poisoned");
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
                save_as_default_script: None,
                restore_default_script: None,
                is_builtin: false,
            };
            guard.export_targets.push(new_item.clone());
            new_item
        };
        write_encrypted(&self.path, &self.key, &guard)?;
        Ok(item)
    }

    pub fn delete_target(&self, id: &str) -> Result<(), StoreError> {
        let mut guard = self.state.lock().expect("store lock poisoned");
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
        let mut guard = self.state.lock().expect("store lock poisoned");
        guard
            .model_health_cache
            .insert(config_id.to_string(), results);
        write_encrypted(&self.path, &self.key, &guard)?;
        Ok(())
    }

    pub fn load_model_health_cache(&self, config_id: &str) -> Option<Vec<ModelHealthResult>> {
        let guard = self.state.lock().expect("store lock poisoned");
        guard.model_health_cache.get(config_id).cloned()
    }

    pub fn remove_model_health_cache(&self, config_id: &str) -> Result<(), StoreError> {
        let mut guard = self.state.lock().expect("store lock poisoned");
        guard.model_health_cache.remove(config_id);
        write_encrypted(&self.path, &self.key, &guard)?;
        Ok(())
    }
}

fn load_or_create_master_key() -> Result<[u8; 32], StoreError> {
    let entry = keyring::Entry::new("llm-config-hub", "master-key")?;
    eprintln!("[keyring] entry created");
    let raw = match entry.get_password() {
        Ok(v) if !v.is_empty() => {
            eprintln!("[keyring] found existing key, len={}", v.len());
            v
        }
        Ok(_) | Err(_) => {
            eprintln!("[keyring] no valid key found, checking migration or generating new");
            // 尝试从旧 service name 迁移
            let migrated = keyring::Entry::new("ai-key-manager", "master-key")
                .ok()
                .and_then(|old_entry| old_entry.get_password().ok())
                .filter(|v| !v.is_empty());
            if let Some(old_val) = migrated {
                eprintln!("[keyring] migrating from ai-key-manager");
                entry.set_password(&old_val)?;
                let _ = keyring::Entry::new("ai-key-manager", "master-key")
                    .map(|e| e.delete_credential());
                old_val
            } else {
                eprintln!("[keyring] generating new master key");
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
    fs::write(path, data)?;
    Ok(())
}
