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

# 检查 OAuth 回调域名。此配置会推送到线上 Supabase，site_url 必须是线上域名。
if ! grep -q "^site_url\s*=\s*\"https://gitbookai.ccwu.cc\"" "$CONFIG_FILE" 2>/dev/null; then
    echo "❌ 错误: site_url 必须指向线上域名，避免 OAuth 回调回到本地地址"
    echo "   应该设置为: site_url = \"https://gitbookai.ccwu.cc\""
    ERRORS=$((ERRORS + 1))
fi

for redirect_url in \
    '"https://gitbookai.ccwu.cc/**"' \
    '"https://*.vercel.app/**"' \
    '"http://localhost:3000/**"' \
    '"http://127.0.0.1:3000/**"'
do
    if ! grep -Fq "$redirect_url" "$CONFIG_FILE" 2>/dev/null; then
        echo "❌ 错误: additional_redirect_urls 缺少 $redirect_url"
        ERRORS=$((ERRORS + 1))
    fi
done

if grep -q "127.0.0.1:3000\"$" "$CONFIG_FILE" 2>/dev/null; then
    echo "❌ 错误: site_url 不能指向 127.0.0.1，否则 Google/GitHub OAuth 会回跳本地"
    ERRORS=$((ERRORS + 1))
fi

if [ $ERRORS -eq 0 ]; then
    echo "✅ 配置检查通过"
    exit 0
else
    echo "❌ 发现 $ERRORS 个配置问题"
    exit 1
fi
