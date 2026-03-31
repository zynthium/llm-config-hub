#!/usr/bin/env bash
set -euo pipefail
CONFIG="$HOME/.claude/settings.json"
CONFIG_DIR="$(dirname "$CONFIG")"
BAK_PREFIX="settings.bak."
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

# 保留已有字段，仅覆盖 env 中的 API 相关字段
if command -v python3 &>/dev/null; then
  python3 - <<'PYEOF'
import json, os
p = os.path.expanduser('~/.claude/settings.json')
data = {}
if os.path.exists(p):
    try:
        with open(p, encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        pass
env = data.setdefault('env', {})
default_model = "{{defaultModel}}".strip()
env['ANTHROPIC_AUTH_TOKEN'] = '{{apiKey}}'
env['ANTHROPIC_BASE_URL'] = '{{baseUrl}}'
env['CLAUDE_CODE_MAX_OUTPUT_TOKENS'] = '32000'
env['CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'] = '1'
if default_model:
    env['ANTHROPIC_DEFAULT_HAIKU_MODEL'] = default_model
    env['ANTHROPIC_DEFAULT_SONNET_MODEL'] = default_model
    env['ANTHROPIC_DEFAULT_OPUS_MODEL'] = default_model
    env['ANTHROPIC_MODEL'] = default_model
with open(p, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
PYEOF
else
  DEFAULT_MODEL="{{defaultModel}}"
  if [ -n "${DEFAULT_MODEL}" ]; then
    echo '{"env":{"ANTHROPIC_AUTH_TOKEN":"{{apiKey}}","ANTHROPIC_BASE_URL":"{{baseUrl}}","ANTHROPIC_DEFAULT_HAIKU_MODEL":"{{defaultModel}}","ANTHROPIC_DEFAULT_SONNET_MODEL":"{{defaultModel}}","ANTHROPIC_DEFAULT_OPUS_MODEL":"{{defaultModel}}","ANTHROPIC_MODEL":"{{defaultModel}}","CLAUDE_CODE_MAX_OUTPUT_TOKENS":"32000","CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC":"1"}}' > "$CONFIG"
  else
    echo '{"env":{"ANTHROPIC_AUTH_TOKEN":"{{apiKey}}","ANTHROPIC_BASE_URL":"{{baseUrl}}","CLAUDE_CODE_MAX_OUTPUT_TOKENS":"32000","CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC":"1"}}' > "$CONFIG"
  fi
fi
echo "Claude Code 配置已更新: $CONFIG"
