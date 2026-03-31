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

latest_backup() {
  local dir="$1" prefix="$2" latest=""
  for candidate in "$dir"/"${prefix}"*; do
    [ -f "$candidate" ] || continue
    latest="$candidate"
  done
  [ -n "$latest" ] || return 1
  printf '%s\n' "$latest"
}

LATEST="$(latest_backup "$BAK_DIR" "$BAK_PREFIX" || true)"
if [ -z "$LATEST" ]; then
  echo "未找到 Gemini CLI 备份文件: $BAK_DIR/${BAK_PREFIX}*"
  exit 1
fi

cp "$LATEST" "$SHELL_RC"
echo "Gemini CLI 默认配置已恢复: $LATEST"
