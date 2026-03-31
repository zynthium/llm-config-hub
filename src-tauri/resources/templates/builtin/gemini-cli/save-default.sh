#!/usr/bin/env bash
set -euo pipefail

USER_SHELL="$(basename "${SHELL:-/bin/bash}")"
SHELL_RC="$HOME/.profile"
case "$USER_SHELL" in
  zsh)  SHELL_RC="$HOME/.zshrc" ;;
  bash) SHELL_RC="$HOME/.bashrc" ;;
  fish) SHELL_RC="$HOME/.config/fish/config.fish" ;;
esac

BAK_PREFIX="$(basename "$SHELL_RC").gemini.bak."
BAK_DIR="$(dirname "$SHELL_RC")"

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

if [ ! -f "$SHELL_RC" ]; then
  echo "未找到 Gemini CLI shell 配置文件: $SHELL_RC"
  exit 1
fi

do_backup "$SHELL_RC" "$BAK_DIR" "$BAK_PREFIX"
