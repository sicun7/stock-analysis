# 生产环境部署指南

## 目录
1. [部署前准备](#部署前准备)
2. [构建项目](#构建项目)
3. [部署方案](#部署方案)
4. [环境配置](#环境配置)
5. [进程管理](#进程管理)
6. [反向代理配置](#反向代理配置)
7. [安全建议](#安全建议)

---

## 部署前准备

### 1. 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- 服务器操作系统：Linux (推荐 Ubuntu 20.04+)

### 2. 生产环境依赖

确保生产环境只安装必要的依赖：

```bash
npm ci --production
```

---

## 构建项目

### 1. 构建前端

```bash
npm run build
```

构建完成后，前端文件会在 `dist/` 目录下。

### 2. 检查构建结果

```bash
# 预览构建结果
npm run preview
```

---

## 部署方案

### 方案1：传统服务器部署（推荐）

#### 步骤1：上传代码到服务器

```bash
# 在本地打包（排除 node_modules）
tar -czf stock-analysis.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='.history' \
  .

# 上传到服务器
scp stock-analysis.tar.gz user@your-server:/path/to/app/

# 在服务器上解压
ssh user@your-server
cd /path/to/app
tar -xzf stock-analysis.tar.gz
```

#### 步骤2：安装依赖

```bash
# 安装所有依赖（包括 devDependencies，用于构建）
npm install

# 构建前端
npm run build

# 安装生产依赖（可选，如果不需要再次构建）
npm ci --production
```

#### 步骤3：配置环境变量

创建 `.env.production` 文件：

```bash
# .env.production
NODE_ENV=production
API_PORT=8888
API_BASE_URL=http://your-domain.com
DB_PATH=./server/database/stock_data.db
```

#### 步骤4：初始化数据库

```bash
npm run init-db
```

#### 步骤5：启动服务

使用 PM2 管理进程（推荐）：

```bash
# 安装 PM2
npm install -g pm2

# 启动后端服务
pm2 start server/api.js --name stock-api

# 启动静态文件服务（如果需要）
pm2 start npm --name stock-frontend -- run preview

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
```

---

### 方案2：使用 Express 服务静态文件（一体化部署）

修改 `server/api.js`，添加静态文件服务：

```javascript
import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()

// ... 现有 API 路由 ...

// 生产环境：服务静态文件
if (process.env.NODE_ENV === 'production') {
  const distPath = join(__dirname, '..', 'dist')
  app.use(express.static(distPath))
  
  // SPA 路由回退
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
```

**启动方式：**
```bash
# 构建前端
npm run build

# 启动服务（同时提供 API 和前端）
NODE_ENV=production node server/api.js
```

或使用 PM2：
```bash
pm2 start server/api.js --name stock-app --env production
```

---

### 方案3：Docker 部署

#### 创建 Dockerfile

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建前端
RUN npm run build

# 生产环境镜像
FROM node:18-alpine

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 只安装生产依赖
RUN npm ci --production

# 从构建阶段复制文件
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/public ./public

# 创建数据库目录
RUN mkdir -p server/database

# 暴露端口
EXPOSE 8888

# 启动命令
CMD ["node", "server/api.js"]
```

#### 创建 .dockerignore

```
node_modules
dist
.git
.history
*.log
.env.local
.DS_Store
```

#### 构建和运行

```bash
# 构建镜像
docker build -t stock-analysis:latest .

# 运行容器
docker run -d \
  --name stock-app \
  -p 8888:8888 \
  -v $(pwd)/server/database:/app/server/database \
  stock-analysis:latest
```

#### 使用 Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8888:8888"
    volumes:
      - ./server/database:/app/server/database
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

```bash
docker-compose up -d
```

---

### 方案4：云服务部署

#### Vercel / Netlify（仅前端）+ 独立后端

**前端部署到 Vercel：**
```bash
npm install -g vercel
vercel --prod
```

**后端部署到：**
- Railway
- Render
- Heroku
- 或自己的服务器

#### 全栈部署到 Railway / Render

1. 连接 GitHub 仓库
2. 设置构建命令：`npm run build`
3. 设置启动命令：`NODE_ENV=production node server/api.js`
4. 配置环境变量

---

## 环境配置

### 1. 创建环境变量文件

```bash
# .env.production
NODE_ENV=production
PORT=8888
API_BASE_URL=https://your-domain.com
DB_PATH=./server/database/stock_data.db
CORS_ORIGIN=https://your-domain.com
```

### 2. 使用 dotenv（可选）

安装 dotenv：
```bash
npm install dotenv
```

在 `server/api.js` 中：
```javascript
import dotenv from 'dotenv'
dotenv.config({ path: '.env.production' })
```

### 3. 更新配置文件

修改 `server/config/index.js`：

```javascript
export const SERVER_CONFIG = {
  port: process.env.PORT || 8888,
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  }
}
```

---

## 进程管理

### 使用 PM2（推荐）

#### 安装 PM2
```bash
npm install -g pm2
```

#### 创建 PM2 配置文件

```javascript
// ecosystem.config.js
export default {
  apps: [{
    name: 'stock-api',
    script: 'server/api.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 8888
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
}
```

#### PM2 常用命令

```bash
# 启动
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 重启
pm2 restart stock-api

# 停止
pm2 stop stock-api

# 删除
pm2 delete stock-api

# 保存配置
pm2 save

# 设置开机自启
pm2 startup
```

---

## 反向代理配置

### Nginx 配置示例

```nginx
# /etc/nginx/sites-available/stock-analysis
server {
    listen 80;
    server_name your-domain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书配置
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # 前端静态文件
    location / {
        root /path/to/app/dist;
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://localhost:8888;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

启用配置：
```bash
sudo ln -s /etc/nginx/sites-available/stock-analysis /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 安全建议

### 1. 环境变量

- ✅ 不要提交 `.env` 文件到 Git
- ✅ 使用环境变量管理敏感信息
- ✅ 生产环境使用强密码和密钥

### 2. CORS 配置

在生产环境中限制 CORS：

```javascript
// server/api.js
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://your-domain.com',
  credentials: true
}))
```

### 3. 数据库安全

- ✅ 定期备份数据库
- ✅ 限制数据库文件权限
- ✅ 使用环境变量配置数据库路径

### 4. HTTPS

- ✅ 使用 Let's Encrypt 免费 SSL 证书
- ✅ 配置 Nginx 反向代理
- ✅ 强制 HTTPS 重定向

### 5. 防火墙

```bash
# 只开放必要端口
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

### 6. 日志管理

- ✅ 配置日志轮转
- ✅ 监控错误日志
- ✅ 定期清理旧日志

---

## 部署检查清单

### 部署前
- [ ] 代码已测试通过
- [ ] 环境变量已配置
- [ ] 数据库已初始化
- [ ] 构建命令测试通过

### 部署中
- [ ] 代码已上传到服务器
- [ ] 依赖已安装
- [ ] 前端已构建
- [ ] 数据库已初始化
- [ ] 服务已启动

### 部署后
- [ ] 前端页面可访问
- [ ] API 接口正常
- [ ] 数据库连接正常
- [ ] 日志无错误
- [ ] HTTPS 配置正确
- [ ] 进程管理已配置
- [ ] 开机自启已设置

---

## 快速部署脚本

创建 `deploy.sh`：

```bash
#!/bin/bash

# 部署脚本
set -e

echo "开始部署..."

# 1. 构建前端
echo "构建前端..."
npm run build

# 2. 安装生产依赖
echo "安装依赖..."
npm ci --production

# 3. 初始化数据库（如果需要）
# npm run init-db

# 4. 重启服务
echo "重启服务..."
pm2 restart stock-api || pm2 start server/api.js --name stock-api

echo "部署完成！"
```

使用：
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 常见问题

### 1. 端口被占用

```bash
# 查找占用端口的进程
lsof -i :8888

# 杀死进程
kill -9 <PID>
```

### 2. 权限问题

```bash
# 确保数据库目录有写权限
chmod -R 755 server/database
```

### 3. 构建失败

```bash
# 清理缓存
rm -rf node_modules dist
npm install
npm run build
```

---

## 监控和维护

### 1. 日志监控

```bash
# 实时查看日志
pm2 logs stock-api

# 查看错误日志
pm2 logs stock-api --err
```

### 2. 性能监控

```bash
# PM2 监控
pm2 monit
```

### 3. 定期备份

```bash
# 备份数据库
cp server/database/stock_data.db server/database/backup_$(date +%Y%m%d).db
```

---

## 总结

推荐部署流程：

1. **开发环境测试** → 确保功能正常
2. **构建前端** → `npm run build`
3. **配置环境变量** → 创建 `.env.production`
4. **上传代码** → 到生产服务器
5. **安装依赖** → `npm ci --production`
6. **初始化数据库** → `npm run init-db`
7. **启动服务** → 使用 PM2
8. **配置 Nginx** → 反向代理和 HTTPS
9. **验证部署** → 检查所有功能

