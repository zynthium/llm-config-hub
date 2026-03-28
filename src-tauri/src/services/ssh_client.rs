use std::fs;
use std::path::PathBuf;
use std::process::Command;

use crate::types::SshImportInput;

pub fn import_via_ssh(input: &SshImportInput, payload: &str) -> Result<(), String> {
    let remote_path = input
        .remote_path
        .clone()
        .unwrap_or_else(|| default_remote_path(&input.editor));
    let temp_name = format!("/tmp/akm-import-{}.json", input.editor);
    let local_tmp = temp_local_file()?;
    fs::write(&local_tmp, payload).map_err(|e| e.to_string())?;

    let host = format!("{}@{}", input.user, input.host);
    run_cmd(
        "scp",
        &[
            "-P",
            &input.port.to_string(),
            "-i",
            &input.private_key_path,
            local_tmp.to_str().ok_or("invalid temp path")?,
            &format!("{host}:{temp_name}"),
        ],
    )?;

    let parent = PathBuf::from(&remote_path)
        .parent()
        .map(|v| v.display().to_string())
        .unwrap_or_else(|| "~".to_string());

    // 备份逻辑：若目标文件存在，先检查同目录下是否已有内容一致的备份，无则创建带时间戳的备份
    let backup_cmd = format!(
        r#"if [ -f {remote_path} ]; then \
  _content=$(cat {remote_path}); \
  _ts=$(date +%s); \
  _stem=$(basename {remote_path} .json); \
  _dir={parent}; \
  _found=0; \
  for _bak in "$_dir"/*.bak.*  "$_dir"/*.bak; do \
    [ -f "$_bak" ] || continue; \
    if [ "$(cat "$_bak")" = "$_content" ]; then _found=1; break; fi; \
  done; \
  if [ "$_found" = "0" ]; then cp {remote_path} "$_dir/$_stem.$_ts.bak.json"; fi; \
fi"#
    );
    run_cmd(
        "ssh",
        &[
            "-p",
            &input.port.to_string(),
            "-i",
            &input.private_key_path,
            &host,
            &backup_cmd,
        ],
    )?;

    let deploy_cmd = format!("mkdir -p {parent} && cp {temp_name} {remote_path}");
    run_cmd(
        "ssh",
        &[
            "-p",
            &input.port.to_string(),
            "-i",
            &input.private_key_path,
            &host,
            &deploy_cmd,
        ],
    )?;
    Ok(())
}

fn temp_local_file() -> Result<PathBuf, String> {
    let mut tmp = std::env::temp_dir();
    tmp.push(format!("akm-{}.json", uuid::Uuid::new_v4()));
    Ok(tmp)
}

fn run_cmd(bin: &str, args: &[&str]) -> Result<(), String> {
    let output = Command::new(bin)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

fn default_remote_path(editor: &str) -> String {
    match editor {
        "claude-code" => "~/.claude/config.json".to_string(),
        "cursor" => "~/.cursor/config.json".to_string(),
        "codex" => "~/.codex/config.json".to_string(),
        "openclaw" => "~/.openclaw/config.json".to_string(),
        _ => "~/.akm/config.json".to_string(),
    }
}
