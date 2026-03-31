#!/usr/bin/env bash
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
echo "Opencode 配置已更新: $CONFIG"
