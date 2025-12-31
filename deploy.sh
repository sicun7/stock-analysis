#!/bin/bash

# 生产环境部署脚本
set -e

echo "🚀 开始部署到生产环境..."

# 检查 Node.js 版本
echo "📦 检查环境..."
node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
  echo "❌ 错误: 需要 Node.js 18 或更高版本"
  exit 1
fi

# 1. 安装依赖
echo "📥 安装依赖..."
npm ci

# 2. 构建前端
echo "🔨 构建前端..."
npm run build

# 3. 检查构建结果
if [ ! -d "dist" ]; then
  echo "❌ 错误: 构建失败，dist 目录不存在"
  exit 1
fi

echo "✅ 前端构建完成"

# 4. 检查数据库
if [ ! -f "server/database/stock_data.db" ]; then
  echo "⚠️  警告: 数据库文件不存在，是否初始化？(y/n)"
  read -r response
  if [ "$response" = "y" ]; then
    echo "📊 初始化数据库..."
    npm run init-db
  fi
fi

# 5. 创建日志目录
mkdir -p logs

# 6. 安装 PM2（如果未安装）
if ! command -v pm2 &> /dev/null; then
  echo "📦 安装 PM2..."
  npm install -g pm2
fi

# 7. 停止旧服务（如果存在）
echo "🛑 停止旧服务..."
pm2 delete stock-api 2>/dev/null || true

# 8. 启动服务
echo "▶️  启动服务..."
pm2 start ecosystem.config.js --env production

# 9. 保存 PM2 配置
pm2 save

echo ""
echo "✅ 部署完成！"
echo ""
echo "📊 服务状态:"
pm2 status
echo ""
echo "📝 查看日志: pm2 logs stock-api"
echo "🔄 重启服务: pm2 restart stock-api"
echo "🛑 停止服务: pm2 stop stock-api"

