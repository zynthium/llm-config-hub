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

if [ ! -f "$SHELL_RC" ]; then
  echo "未找到 Gemini CLI shell 配置文件: $SHELL_RC"
  exit 1
fi

if [ -f "$DEFAULT_BAK" ]; then
  src_hash="$(shasum -a 256 "$SHELL_RC" 2>/dev/null | awk '{print $1}' || md5sum "$SHELL_RC" 2>/dev/null | awk '{print $1}')"
  bak_hash="$(shasum -a 256 "$DEFAULT_BAK" 2>/dev/null | md5sum "$DEFAULT_BAK" 2>/dev/null | awk '{print $1}')"
  if [ "$src_hash" = "$bak_hash" ]; then
    echo "当前配置与备份一致，无需重复备份"
    exit 0
  fi
fi

cp "$SHELL_RC" "$DEFAULT_BAK"
echo "已备份至: $DEFAULT_BAK"
