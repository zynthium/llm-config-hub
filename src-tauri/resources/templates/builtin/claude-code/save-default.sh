#!/usr/bin/env bash
set -euo pipefail
CONFIG="$HOME/.claude/settings.json"
CONFIG_DIR="$(dirname "$CONFIG")"
BAK_PREFIX="settings.bak."
mkdir -p "$CONFIG_DIR"

do_backup() {
  local src="$1" dir="$2" prefix="$3"
  local src_hash
  src_hash="$(shasum -a 256 "$src" 2>/dev/null | awk '{print $1}' || md5sum "$src" 2>/dev/null | awk '{print $1}')"
  for bak in "$dir/${prefix}"*; do
    [ -f "$bak" ] || continue
    local bak_hash
    bak_hash="$(shasum -a 256 "$bak" 2>/dev/null | awk '{print $1}' || md5sum "$bak" 2>/dev/null | awk '{print $1}')"
    if [ "$src_hash" = "$bak_hash" ]; then
      echo "已存在内容相同的备份: $bak"
      return 0
    fi
  done
  local dst="$dir/${prefix}$(date +%s)"
  cp "$src" "$dst"
  echo "已备份至: $dst"
}

if [ ! -f "$CONFIG" ]; then
  echo "未找到 Claude Code 配置: $CONFIG"
  exit 1
fi

do_backup "$CONFIG" "$CONFIG_DIR" "$BAK_PREFIX"
