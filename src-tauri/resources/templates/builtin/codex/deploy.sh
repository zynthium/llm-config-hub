#!/usr/bin/env bash
set -euo pipefail
CODEX_DIR="$HOME/.codex"
CONFIG="$CODEX_DIR/config.toml"
AUTH="$CODEX_DIR/auth.json"
mkdir -p "$CODEX_DIR"

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

[ -f "$CONFIG" ] && do_backup "$CONFIG" "$CODEX_DIR" "config.toml.bak."
[ -f "$AUTH" ] && do_backup "$AUTH" "$CODEX_DIR" "auth.json.bak."

# 写入 config.toml
cat > "$CONFIG" <<EOF
model_provider = "custom"
model = "{{defaultModel}}"
model_reasoning_effort = "high"
network_access = "enabled"
disable_response_storage = true

[model_providers.custom]
name = "custom"
base_url = "{{baseUrl}}"
wire_api = "responses"
requires_openai_auth = true
EOF

# 写入 auth.json
cat > "$AUTH" <<EOF
{
  "OPENAI_API_KEY": "{{apiKey}}"
}
EOF

echo "Codex CLI 配置已更新:"
echo "  $CONFIG"
echo "  $AUTH"
