#!/usr/bin/env bash
set -euo pipefail
CONFIG="$HOME/.config/opencode/opencode.json"
CONFIG_DIR="$(dirname "$CONFIG")"
DEFAULT_BAK="$CONFIG.default"
mkdir -p "$CONFIG_DIR"

if [ ! -f "$DEFAULT_BAK" ]; then
  echo "未找到 Opencode 备份文件: $DEFAULT_BAK"
  exit 1
fi

cp "$DEFAULT_BAK" "$CONFIG"
echo "Opencode 默认配置已恢复: $DEFAULT_BAK"
