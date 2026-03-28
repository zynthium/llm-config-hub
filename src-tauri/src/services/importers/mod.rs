use std::fs;
use std::path::{Path, PathBuf};

use serde_json::json;

use crate::types::{LocalImportTarget, ModelConfig};

pub fn detect_targets() -> Vec<LocalImportTarget> {
    let mut result = Vec::new();
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    for (editor, path) in known_editor_paths(&home) {
        result.push(LocalImportTarget {
            editor: editor.to_string(),
            exists: path.exists(),
            path: path.display().to_string(),
        });
    }
    result
}

pub fn import_to_local(target: &LocalImportTarget, config: &ModelConfig) -> Result<(), String> {
    let path = PathBuf::from(&target.path);
    let parent = path
        .parent()
        .ok_or("invalid target path".to_string())?
        .to_path_buf();
    if !parent.exists() {
        fs::create_dir_all(&parent).map_err(|e| e.to_string())?;
    }
    if path.exists() {
        let current = fs::read(&path).map_err(|e| e.to_string())?;
        if !has_identical_backup(&parent, &current)? {
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let stem = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("config");
            let ext = path
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("json");
            let backup_name = format!("{}.{}.bak.{}", stem, ts, ext);
            let backup = parent.join(backup_name);
            fs::copy(&path, &backup).map_err(|e| e.to_string())?;
        }
    }
    let payload = config_payload(config);
    fs::write(path, payload).map_err(|e| e.to_string())
}

/// 检查目录下是否已存在与 `content` 内容完全一致的 .bak.* 备份文件
fn has_identical_backup(dir: &Path, content: &[u8]) -> Result<bool, String> {
    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if name_str.contains(".bak.") || name_str.ends_with(".bak") {
            if let Ok(existing) = fs::read(entry.path()) {
                if existing == content {
                    return Ok(true);
                }
            }
        }
    }
    Ok(false)
}

fn config_payload(config: &ModelConfig) -> String {
    let payload = json!({
      "provider": config.provider,
      "name": config.name,
      "baseUrl": config.base_url,
      "apiKey": config.api_key,
      "model": config.default_model,
      "headers": config.headers
    });
    serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".to_string())
}

fn known_editor_paths(home: &Path) -> Vec<(&'static str, PathBuf)> {
    vec![
        ("claude-code", home.join(".claude").join("config.json")),
        ("cursor", home.join(".cursor").join("config.json")),
        ("codex", home.join(".codex").join("config.json")),
        ("openclaw", home.join(".openclaw").join("config.json")),
    ]
}

