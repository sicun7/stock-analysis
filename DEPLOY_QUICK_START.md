# 快速部署指南

## 🚀 最简单的部署方式（推荐）

### 方式1：使用部署脚本（一键部署）

```bash
# 1. 确保已安装 Node.js 18+
node -v

# 2. 运行部署脚本
./deploy.sh

# 完成！服务已启动在 http://localhost:8888
```

### 方式2：手动部署

```bash
# 1. 安装依赖
npm ci

# 2. 构建前端
npm run build

# 3. 初始化数据库（首次部署）
npm run init-db

# 4. 启动服务（生产模式）
NODE_ENV=production node server/api.js
```

### 方式3：使用 PM2（推荐用于生产环境）

```bash
# 1. 安装 PM2
npm install -g pm2

# 2. 构建前端
npm run build

# 3. 启动服务
pm2 start ecosystem.config.js --env production

# 4. 保存配置
pm2 save

# 5. 设置开机自启
pm2 startup
```

### 方式4：使用 Docker

```bash
# 1. 构建镜像
docker build -t stock-analysis:latest .

# 2. 运行容器
docker-compose up -d

# 或手动运行
docker run -d \
  --name stock-app \
  -p 8888:8888 \
  -v $(pwd)/server/database:/app/server/database \
  stock-analysis:latest
```

---

## 📋 部署检查清单

- [ ] Node.js 18+ 已安装
- [ ] 代码已上传到服务器
- [ ] 依赖已安装 (`npm ci`)
- [ ] 前端已构建 (`npm run build`)
- [ ] 数据库已初始化 (`npm run init-db`)
- [ ] 环境变量已配置（如需要）
- [ ] 服务已启动
- [ ] 端口 8888 已开放
- [ ] 前端页面可访问
- [ ] API 接口正常

---

## 🔧 常用命令

```bash
# 查看服务状态（PM2）
pm2 status

# 查看日志
pm2 logs stock-api

# 重启服务
pm2 restart stock-api

# 停止服务
pm2 stop stock-api

# 查看构建结果
npm run preview
```

---

## 🌐 配置域名和 HTTPS

### 使用 Nginx 反向代理

1. 安装 Nginx
2. 配置反向代理（参考 DEPLOYMENT.md）
3. 配置 SSL 证书（Let's Encrypt）
4. 重启 Nginx

详细步骤请查看 `DEPLOYMENT.md` 文件。

---

## 📝 注意事项

1. **数据库备份**：定期备份 `server/database/stock_data.db`
2. **日志管理**：定期清理 `logs/` 目录
3. **端口配置**：确保防火墙开放 8888 端口
4. **环境变量**：生产环境使用 `.env.production`

---

更多详细信息请查看 `DEPLOYMENT.md`

