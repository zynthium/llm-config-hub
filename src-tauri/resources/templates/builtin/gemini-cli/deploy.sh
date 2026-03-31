#!/usr/bin/env bash
set -euo pipefail

# Gemini CLI 通过环境变量 GEMINI_API_KEY 认证，不支持自定义 baseURL
# 根据用户默认 shell 选择 profile 文件
USER_SHELL="$(basename "${SHELL:-/bin/bash}")"
SHELL_RC="$HOME/.profile"
case "$USER_SHELL" in
  zsh)  SHELL_RC="$HOME/.zshrc" ;;
  bash) SHELL_RC="$HOME/.bashrc" ;;
  fish) SHELL_RC="$HOME/.config/fish/config.fish" ;;
esac

BAK_PREFIX="$(basename "$SHELL_RC").gemini.bak."
BAK_DIR="$(dirname "$SHELL_RC")"

# 备份函数：仅当不存在内容相同的备份时才创建新备份
do_backup() {
  local src="$1" dir="$2" prefix="$3"
  [ -f "$src" ] || return 0
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

do_backup "$SHELL_RC" "$BAK_DIR" "$BAK_PREFIX"

# 移除旧的 GEMINI_API_KEY 设置
if [ -f "$SHELL_RC" ]; then
  sed -i.tmp '/# gemini-cli GEMINI_API_KEY/d' "$SHELL_RC"
  sed -i.tmp '/export GEMINI_API_KEY=/d' "$SHELL_RC"
  rm -f "${SHELL_RC}.tmp"
fi

# 写入新的 GEMINI_API_KEY
echo '# gemini-cli GEMINI_API_KEY' >> "$SHELL_RC"
echo 'export GEMINI_API_KEY="{{apiKey}}"' >> "$SHELL_RC"

echo "Gemini CLI 配置已更新: $SHELL_RC"
echo "请重新加载 shell 或运行: source $SHELL_RC"
