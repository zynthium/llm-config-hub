#!/usr/bin/env bash
set -euo pipefail
CODEX_DIR="$HOME/.codex"
CONFIG="$CODEX_DIR/config.toml"
AUTH="$CODEX_DIR/auth.json"
mkdir -p "$CODEX_DIR"

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

backed_up=0
if [ -f "$CONFIG" ]; then
  do_backup "$CONFIG" "$CODEX_DIR" "config.toml.bak."
  backed_up=1
fi
if [ -f "$AUTH" ]; then
  do_backup "$AUTH" "$CODEX_DIR" "auth.json.bak."
  backed_up=1
fi

if [ "$backed_up" -eq 0 ]; then
  echo "未找到可备份的 Codex CLI 配置文件"
  exit 1
fi
