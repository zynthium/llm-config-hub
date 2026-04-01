#!/usr/bin/env bash
set -euo pipefail
SHELL_RC="$HOME/.zshrc"
[ -f "$HOME/.bashrc" ] && SHELL_RC="$HOME/.bashrc"
DEFAULT_BAK="$SHELL_RC.default"

if [ ! -f "$DEFAULT_BAK" ]; then
  echo "未找到 Cursor 备份文件: $DEFAULT_BAK"
  exit 1
fi

cp "$DEFAULT_BAK" "$SHELL_RC"
echo "Cursor 相关 shell 配置已恢复: $DEFAULT_BAK"
