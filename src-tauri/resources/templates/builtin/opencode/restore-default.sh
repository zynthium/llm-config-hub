#!/usr/bin/env bash
set -euo pipefail
CONFIG="$HOME/.config/opencode/opencode.json"
CONFIG_DIR="$(dirname "$CONFIG")"
BAK_PREFIX="opencode.bak."
mkdir -p "$CONFIG_DIR"

latest_backup() {
  local dir="$1" prefix="$2" latest=""
  for candidate in "$dir"/"${prefix}"*; do
    [ -f "$candidate" ] || continue
    latest="$candidate"
  done
  [ -n "$latest" ] || return 1
  printf '%s\n' "$latest"
}

LATEST="$(latest_backup "$CONFIG_DIR" "$BAK_PREFIX" || true)"
if [ -z "$LATEST" ]; then
  echo "未找到 Opencode 备份文件: $CONFIG_DIR/${BAK_PREFIX}*"
  exit 1
fi

cp "$LATEST" "$CONFIG"
echo "Opencode 默认配置已恢复: $LATEST"
