#!/bin/bash
# 检查关键配置是否正确
set -euo pipefail

CONFIG_FILE="supabase/config.toml"
ERRORS=0

echo "🔍 检查 Supabase 配置..."

# 检查 enable_confirmations
if grep -q "^\s*enable_confirmations\s*=\s*true" "$CONFIG_FILE" 2>/dev/null; then
    echo "❌ 错误: enable_confirmations = true 会阻止未验证用户登录"
    echo "   应该设置为: enable_confirmations = false"
    ERRORS=$((ERRORS + 1))
fi

# 检查 site_url 是否为线上环境（本地开发应该是 localhost）
if grep -q "^site_url\s*=\s*\"https://gitbookai" "$CONFIG_FILE" 2>/dev/null; then
    echo "⚠️  警告: site_url 指向线上环境，本地开发应该是 http://127.0.0.1:3000"
fi

if [ $ERRORS -eq 0 ]; then
    echo "✅ 配置检查通过"
    exit 0
else
    echo "❌ 发现 $ERRORS 个配置问题"
    exit 1
fi
