#!/usr/bin/env bash
set -euo pipefail

USER_SHELL="$(basename "${SHELL:-/bin/bash}")"
SHELL_RC="$HOME/.profile"
case "$USER_SHELL" in
  zsh)  SHELL_RC="$HOME/.zshrc" ;;
  bash) SHELL_RC="$HOME/.bashrc" ;;
  fish) SHELL_RC="$HOME/.config/fish/config.fish" ;;
esac

DEFAULT_BAK="$SHELL_RC.default"

if [ ! -f "$DEFAULT_BAK" ]; then
  echo "未找到 Gemini CLI 备份文件: $DEFAULT_BAK"
  exit 1
fi

cp "$DEFAULT_BAK" "$SHELL_RC"
echo "Gemini CLI 默认配置已恢复: $DEFAULT_BAK"
