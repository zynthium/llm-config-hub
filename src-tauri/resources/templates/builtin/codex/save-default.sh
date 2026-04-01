#!/usr/bin/env bash
set -euo pipefail
CODEX_DIR="$HOME/.codex"
CONFIG="$CODEX_DIR/config.toml"
AUTH="$CODEX_DIR/auth.json"
mkdir -p "$CODEX_DIR"

backed_up=0

if [ -f "$CONFIG" ]; then
  DEFAULT_BAK="$CONFIG.default"
  if [ -f "$DEFAULT_BAK" ]; then
    src_hash="$(shasum -a 256 "$CONFIG" 2>/dev/null | awk '{print $1}' || md5sum "$CONFIG" 2>/dev/null | awk '{print $1}')"
    bak_hash="$(shasum -a 256 "$DEFAULT_BAK" 2>/dev/null | md5sum "$DEFAULT_BAK" 2>/dev/null | awk '{print $1}')"
    if [ "$src_hash" = "$bak_hash" ]; then
      echo "config.toml 当前配置与备份一致，无需重复备份"
    else
      cp "$CONFIG" "$DEFAULT_BAK"
      echo "已备份 config.toml 至: $DEFAULT_BAK"
    fi
  else
    cp "$CONFIG" "$DEFAULT_BAK"
    echo "已备份 config.toml 至: $DEFAULT_BAK"
  fi
  backed_up=1
fi

if [ -f "$AUTH" ]; then
  DEFAULT_BAK="$AUTH.default"
  if [ -f "$DEFAULT_BAK" ]; then
    src_hash="$(shasum -a 256 "$AUTH" 2>/dev/null | awk '{print $1}' || md5sum "$AUTH" 2>/dev/null | awk '{print $1}')"
    bak_hash="$(shasum -a 256 "$DEFAULT_BAK" 2>/dev/null | md5sum "$DEFAULT_BAK" 2>/dev/null | awk '{print $1}')"
    if [ "$src_hash" = "$bak_hash" ]; then
      echo "auth.json 当前配置与备份一致，无需重复备份"
    else
      cp "$AUTH" "$DEFAULT_BAK"
      echo "已备份 auth.json 至: $DEFAULT_BAK"
    fi
  else
    cp "$AUTH" "$DEFAULT_BAK"
    echo "已备份 auth.json 至: $DEFAULT_BAK"
  fi
  backed_up=1
fi

if [ "$backed_up" -eq 0 ]; then
  echo "未找到可备份的 Codex CLI 配置文件"
  exit 1
fi
