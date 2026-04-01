#!/usr/bin/env bash
set -euo pipefail
CODEX_DIR="$HOME/.codex"
CONFIG="$CODEX_DIR/config.toml"
AUTH="$CODEX_DIR/auth.json"
mkdir -p "$CODEX_DIR"

restored=0

CONFIG_DEFAULT="$CONFIG.default"
if [ -f "$CONFIG_DEFAULT" ]; then
  cp "$CONFIG_DEFAULT" "$CONFIG"
  echo "已恢复 config.toml: $CONFIG_DEFAULT"
  restored=1
fi

AUTH_DEFAULT="$AUTH.default"
if [ -f "$AUTH_DEFAULT" ]; then
  cp "$AUTH_DEFAULT" "$AUTH"
  echo "已恢复 auth.json: $AUTH_DEFAULT"
  restored=1
fi

if [ "$restored" -eq 0 ]; then
  echo "未找到 Codex CLI 备份文件"
  exit 1
fi
