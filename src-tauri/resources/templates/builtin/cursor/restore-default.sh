#!/usr/bin/env bash
set -euo pipefail
SHELL_RC="$HOME/.zshrc"
[ -f "$HOME/.bashrc" ] && SHELL_RC="$HOME/.bashrc"
BAK_DIR="$(dirname "$SHELL_RC")"
BAK_PREFIX="$(basename "$SHELL_RC").cursor.bak."

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
  echo "未找到 Cursor 备份文件: $BAK_DIR/${BAK_PREFIX}*"
  exit 1
fi

cp "$LATEST" "$SHELL_RC"
echo "Cursor 相关 shell 配置已恢复: $LATEST"
