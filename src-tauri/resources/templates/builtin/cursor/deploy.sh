#!/usr/bin/env bash
set -euo pipefail
# Cursor 不支持通过配置文件设置自定义 API BaseURL
# 官方仅支持在 Cursor Settings -> Models 界面手动填写 API Key
# 此脚本将 API Key 写入环境变量供参考，并打印操作指引
SHELL_RC="$HOME/.zshrc"
[ -f "$HOME/.bashrc" ] && SHELL_RC="$HOME/.bashrc"

# 移除旧条目避免重复
if [ -f "$SHELL_RC" ]; then
  sed -i.bak '/# cursor api override/d' "$SHELL_RC"
  sed -i.bak '/export OPENAI_API_KEY=.*cursor/d' "$SHELL_RC"
  sed -i.bak '/export ANTHROPIC_API_KEY=.*cursor/d' "$SHELL_RC"
fi

echo ''
echo '========================================'
echo 'Cursor 不支持通过配置文件设置自定义 BaseURL'
echo '请手动在 Cursor 中完成以下配置：'
echo '  1. 打开 Cursor -> Settings -> Models'
echo '  2. 在 OpenAI API Key 处填写你的 API Key：{{apiKey}}'
echo '  3. 若使用 Azure/Bedrock，在对应区域填写 Endpoint'
echo '  4. 自定义 BaseURL 需使用 OpenAI-compatible 代理'
echo '========================================'
echo ''
echo "你的 API Key: {{apiKey}}"
echo "你的 BaseURL:  {{baseUrl}} （需在代理层配置，Cursor 不支持直接设置）"
