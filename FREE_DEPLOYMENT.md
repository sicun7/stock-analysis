# 免费部署指南（无需域名和服务器）

本指南介绍如何将项目免费部署到互联网上，无需购买域名和服务器。

## 🎯 推荐平台对比

| 平台 | 免费额度 | 优点 | 缺点 | 推荐度 |
|------|---------|------|------|--------|
| **Railway** | $5/月 | 简单易用，自动部署，支持数据库 | 需要信用卡（不扣费） | ⭐⭐⭐⭐⭐ |
| **Render** | 免费 | 完全免费，支持数据库 | 15分钟无活动会休眠 | ⭐⭐⭐⭐ |
| **Fly.io** | 免费 | 全球CDN，性能好 | 配置稍复杂 | ⭐⭐⭐⭐ |
| **Vercel** | 免费 | 速度快，CDN | 需要调整架构 | ⭐⭐⭐ |

---

## 🚀 方案1：Railway（最推荐）

### 优点
- ✅ 最简单易用
- ✅ 自动从 GitHub 部署
- ✅ 提供免费域名（如：`your-app.railway.app`）
- ✅ 支持持久化存储（数据库文件）
- ✅ 每月 $5 免费额度（足够个人项目使用）

### 部署步骤

#### 1. 准备工作

确保项目已推送到 GitHub：
```bash
git add .
git commit -m "准备部署"
git push origin main
```

#### 2. 注册 Railway

1. 访问 [Railway.app](https://railway.app)
2. 使用 GitHub 账号登录
3. 点击 "New Project"
4. 选择 "Deploy from GitHub repo"
5. 选择你的仓库

#### 3. 配置项目

Railway 会自动检测到 `package.json` 和 `Dockerfile`。

**方式A：使用 Docker（推荐）**

Railway 会自动使用你的 `Dockerfile`，无需额外配置。

**方式B：使用 Node.js**

如果不想用 Docker，可以设置：

1. 在 Railway 项目设置中，添加环境变量：
   ```
   NODE_ENV=production
   PORT=8888
   ```

2. 设置启动命令：
   ```
   npm ci && npm run build && node server/api.js
   ```

#### 4. 配置环境变量

在 Railway 项目设置中添加：
```
NODE_ENV=production
PORT=8888
```

#### 5. 配置数据库持久化

1. 在 Railway 项目中，点击 "New" → "Volume"
2. 挂载路径：`/app/server/database`
3. 这样数据库文件会持久保存

#### 6. 获取访问地址

部署完成后，Railway 会自动分配一个域名，格式如：
```
https://your-app-name.railway.app
```

#### 7. 自定义域名（可选）

如果需要自定义域名：
1. 在项目设置中点击 "Settings" → "Domains"
2. 添加你的域名（需要配置 DNS）

---

## 🌐 方案2：Render（完全免费）

### 优点
- ✅ 完全免费
- ✅ 提供免费域名
- ✅ 支持数据库持久化

### 缺点
- ⚠️ 15分钟无活动会休眠（首次访问需要等待启动）

### 部署步骤

#### 1. 注册 Render

1. 访问 [Render.com](https://render.com)
2. 使用 GitHub 账号登录
3. 点击 "New" → "Web Service"
4. 连接你的 GitHub 仓库

#### 2. 配置服务

- **Name**: `stock-analysis`（或你喜欢的名字）
- **Environment**: `Node`
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `node server/api.js`
- **Plan**: `Free`

#### 3. 环境变量

在 "Environment" 标签页添加：
```
NODE_ENV=production
PORT=10000
```

**注意**：Render 的免费计划使用动态端口，需要通过 `PORT` 环境变量获取。

需要修改 `server/api.js` 来适配 Render：

```javascript
// Render 使用动态端口，必须从环境变量读取
const PORT = process.env.PORT || 8888
```

#### 4. 持久化磁盘（数据库）

1. 在服务设置中，点击 "Disks"
2. 添加磁盘：
   - **Name**: `database`
   - **Mount Path**: `/opt/render/project/src/server/database`
   - **Size**: 1GB（免费额度）

#### 5. 获取访问地址

部署完成后，Render 会提供类似这样的域名：
```
https://your-app-name.onrender.com
```

---

## ✈️ 方案3：Fly.io（全球CDN）

### 优点
- ✅ 全球CDN，速度快
- ✅ 免费额度充足
- ✅ 支持 Docker

### 部署步骤

#### 1. 安装 Fly CLI

```bash
# macOS
curl -L https://fly.io/install.sh | sh

# 或使用 Homebrew
brew install flyctl
```

#### 2. 登录 Fly.io

```bash
fly auth login
```

#### 3. 初始化项目

```bash
fly launch
```

按提示操作：
- App name: 输入应用名称（或自动生成）
- Region: 选择离你最近的区域（如 `hkg` 香港）
- 是否创建 Postgres 数据库：选择 `No`（我们使用 SQLite）

#### 4. 配置持久化存储

```bash
# 创建 volume 用于数据库
fly volumes create database --size 1 --region hkg

# 修改 fly.toml 添加 volume 挂载
```

编辑 `fly.toml`，在 `[mounts]` 部分添加：
```toml
[mounts]
  source = "database"
  destination = "/app/server/database"
```

#### 5. 部署

```bash
fly deploy
```

#### 6. 获取访问地址

```bash
fly open
```

或查看：
```bash
fly status
```

---

## 🔧 通用配置调整

### 1. 修改 server/api.js 适配云平台

确保端口从环境变量读取（已配置）：
```javascript
const PORT = process.env.PORT || 8888
```

### 2. 创建 .env.production（可选）

如果需要，创建 `.env.production`：
```env
NODE_ENV=production
PORT=8888
```

### 3. 确保数据库目录可写

云平台通常需要确保目录权限正确，`Dockerfile` 中已配置。

---

## 📝 部署检查清单

部署前检查：

- [ ] 代码已推送到 GitHub
- [ ] `package.json` 中有 `build` 脚本
- [ ] `Dockerfile` 存在且正确（如果使用 Docker）
- [ ] 环境变量已配置（`NODE_ENV=production`）
- [ ] 数据库目录已配置持久化存储

部署后检查：

- [ ] 访问提供的域名，页面能正常加载
- [ ] API 接口正常（如 `/api/query`）
- [ ] 数据库操作正常
- [ ] 静态资源加载正常

---

## 🐛 常见问题

### 1. 数据库文件丢失

**问题**：重启后数据丢失

**解决**：确保配置了持久化存储（Volume/Disk）

### 2. 端口错误

**问题**：服务无法启动

**解决**：确保从 `process.env.PORT` 读取端口（Render 等平台使用动态端口）

### 3. 构建失败

**问题**：部署时构建错误

**解决**：
- 检查 `package.json` 中的依赖
- 确保 `npm ci` 能正常安装依赖
- 检查 Node.js 版本（需要 18+）

### 4. 静态文件 404

**问题**：前端资源加载失败

**解决**：
- 确保运行了 `npm run build`
- 检查 `dist/` 目录是否被正确复制
- 检查 `server/api.js` 中的静态文件服务配置

---

## 🎉 推荐方案总结

**最推荐：Railway**
- 最简单，自动部署
- 免费额度充足
- 支持持久化存储

**完全免费：Render**
- 无需信用卡
- 适合个人项目
- 注意休眠机制

**高性能：Fly.io**
- 全球CDN
- 适合需要低延迟的场景

---

## 📚 更多资源

- [Railway 文档](https://docs.railway.app)
- [Render 文档](https://render.com/docs)
- [Fly.io 文档](https://fly.io/docs)

---

**提示**：首次部署建议使用 Railway，最简单快速！

