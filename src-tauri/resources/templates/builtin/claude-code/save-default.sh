#!/usr/bin/env bash
set -euo pipefail
CONFIG="$HOME/.claude/settings.json"
CONFIG_DIR="$(dirname "$CONFIG")"
DEFAULT_BAK="$CONFIG.default"
mkdir -p "$CONFIG_DIR"

if [ ! -f "$CONFIG" ]; then
  echo "未找到 Claude Code 配置: $CONFIG"
  exit 1
fi

if [ -f "$DEFAULT_BAK" ]; then
  src_hash="$(shasum -a 256 "$CONFIG" 2>/dev/null | awk '{print $1}' || md5sum "$CONFIG" 2>/dev/null | awk '{print $1}')"
  bak_hash="$(shasum -a 256 "$DEFAULT_BAK" 2>/dev/null | md5sum "$DEFAULT_BAK" 2>/dev/null | awk '{print $1}')"
  if [ "$src_hash" = "$bak_hash" ]; then
    echo "当前配置与备份一致，无需重复备份"
    exit 0
  fi
fi

cp "$CONFIG" "$DEFAULT_BAK"
echo "已备份至: $DEFAULT_BAK"
