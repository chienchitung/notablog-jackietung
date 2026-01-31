#!/bin/bash

# Notablog Notion 同步腳本
# 使用方法: ./sync-notion.sh

echo "🔄 正在從 Notion 同步數據..."

# 使用 --fresh 選項生成，不使用緩存
node bin/cli.js generate --fresh notablog-starter

if [ $? -eq 0 ]; then
    echo "✅ 同步完成！"
    echo "💡 執行 'node bin/cli.js preview notablog-starter' 來預覽"
else
    echo "❌ 同步失敗"
    exit 1
fi
