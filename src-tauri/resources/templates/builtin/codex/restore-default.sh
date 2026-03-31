#!/usr/bin/env bash
set -euo pipefail
CODEX_DIR="$HOME/.codex"
CONFIG="$CODEX_DIR/config.toml"
AUTH="$CODEX_DIR/auth.json"
mkdir -p "$CODEX_DIR"

latest_backup() {
  local dir="$1" prefix="$2" latest=""
  for candidate in "$dir"/"${prefix}"*; do
    [ -f "$candidate" ] || continue
    latest="$candidate"
  done
  [ -n "$latest" ] || return 1
  printf '%s\n' "$latest"
}

restored=0
CONFIG_BACKUP="$(latest_backup "$CODEX_DIR" "config.toml.bak." || true)"
if [ -n "$CONFIG_BACKUP" ]; then
  cp "$CONFIG_BACKUP" "$CONFIG"
  echo "已恢复 Codex 配置: $CONFIG_BACKUP"
  restored=1
fi

AUTH_BACKUP="$(latest_backup "$CODEX_DIR" "auth.json.bak." || true)"
if [ -n "$AUTH_BACKUP" ]; then
  cp "$AUTH_BACKUP" "$AUTH"
  echo "已恢复 Codex 认证: $AUTH_BACKUP"
  restored=1
fi

if [ "$restored" -eq 0 ]; then
  echo "未找到 Codex CLI 备份文件"
  exit 1
fi
