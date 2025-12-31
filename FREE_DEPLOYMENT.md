# 免费部署指南（无需域名和服务器）

本指南介绍如何将项目免费部署到互联网上，无需购买域名和服务器。

## 🎯 推荐平台对比

| 平台 | 免费额度 | 需要信用卡 | 优点 | 缺点 | 推荐度 |
|------|---------|-----------|------|------|--------|
| **Render** | 完全免费 | ❌ 不需要 | 无需信用卡，支持数据库持久化，配置简单 | 15分钟无活动会休眠（首次访问需等待） | ⭐⭐⭐⭐⭐ |
| **Fly.io** | 免费额度 | ✅ 需要 | 全球CDN，性能好，不休眠 | 需要信用卡验证（不扣费），配置稍复杂 | ⭐⭐⭐ |
| **Railway** | 30天试用 | ✅ 需要 | 简单易用，自动部署 | 30天后需付费，需要信用卡 | ⭐⭐ |

**💡 没有信用卡？推荐使用 Render！**
- ✅ **完全免费，无需信用卡**
- ✅ 支持 Node.js 和 Docker
- ✅ 支持数据库持久化存储
- ✅ 提供免费域名
- ⚠️ 唯一缺点：15分钟无活动会休眠（可用 UptimeRobot 免费解决）

---

## 🚀 方案1：Render（最推荐 - 完全免费）

### 优点
- ✅ **完全免费，无需信用卡**
- ✅ 自动从 GitHub 部署
- ✅ 提供免费域名（如：`your-app.onrender.com`）
- ✅ 支持持久化存储（数据库文件）
- ✅ 支持 Docker 和 Node.js

### 缺点
- ⚠️ 15分钟无活动会休眠（首次访问需要等待30秒左右启动）

### 部署步骤

#### 1. 准备工作

确保项目已推送到 GitHub：
```bash
git add .
git commit -m "准备部署"
git push origin main
```

#### 2. 注册 Render

1. 访问 [Render.com](https://render.com)
2. 使用 GitHub 账号登录（无需信用卡）
3. 点击 "New" → "Web Service"
4. 连接你的 GitHub 仓库

#### 3. 配置服务

在创建服务时填写：

- **Name**: `stock-analysis`（或你喜欢的名字）
- **Environment**: `Docker` 或 `Node`
- **Region**: 选择离你最近的区域（如 `Singapore`）
- **Branch**: `main`（或你的主分支）
- **Root Directory**: 留空（使用根目录）
- **Plan**: `Free`

**如果选择 Docker（推荐）**：
- Render 会自动检测并使用 `Dockerfile`
- 无需额外配置

**如果选择 Node**：
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `node server/api.js`

#### 4. 配置环境变量

在 "Environment" 标签页添加：
```
NODE_ENV=production
PORT=10000
```

**重要**：Render 的免费计划使用动态端口，必须通过 `PORT` 环境变量获取。你的 `server/api.js` 已经正确配置了：
```javascript
const PORT = process.env.PORT || 8888
```

#### 5. 配置持久化磁盘（数据库）

这是关键步骤，确保数据库文件不会丢失：

1. 在服务设置中，点击 "Disks" 标签页
2. 点击 "Link Disk"
3. 配置：
   - **Name**: `database`（或任意名称）
   - **Mount Path**: `/opt/render/project/src/server/database`
   - **Size**: 1GB（免费额度足够）

**注意**：如果不配置持久化磁盘，每次重启后数据库文件会丢失！

#### 6. 部署

点击 "Create Web Service"，Render 会自动：
1. 克隆代码
2. 构建项目（如果使用 Docker，会执行 Dockerfile）
3. 启动服务

首次部署可能需要 5-10 分钟。

#### 7. 获取访问地址

部署完成后，Render 会提供类似这样的域名：
```
https://your-app-name.onrender.com
```

#### 8. 处理休眠问题

Render 免费计划会在 15 分钟无活动后休眠。解决方案：

**方案A：接受休眠**
- 首次访问需要等待 30 秒左右启动
- 之后访问会很快

**方案B：使用免费监控服务（保持活跃）**
- 使用 [UptimeRobot](https://uptimerobot.com)（免费）
- 每 5 分钟访问一次你的网站
- 这样服务就不会休眠

**方案C：升级到付费计划**
- 付费计划不会休眠
- 但免费计划对个人项目已经足够

---

## ✈️ 方案2：Fly.io（全球CDN，不休眠）

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

## ✈️ 方案2：Fly.io（全球CDN，不休眠）

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

### 🏆 没有信用卡？选择 Render！

**Render（完全免费，无需信用卡）** ⭐⭐⭐⭐⭐
- ✅ **完全免费，无需信用卡**
- ✅ 自动部署，配置简单
- ✅ 支持持久化存储
- ✅ 提供免费域名
- ⚠️ 15分钟无活动会休眠（可用 UptimeRobot 免费解决）

**这是最适合没有信用卡用户的方案！**

---

### 其他选项（需要信用卡）

**Fly.io（不休眠）** ⭐⭐⭐
- ✅ 全球CDN，性能好
- ✅ 不会休眠
- ✅ 免费额度充足
- ❌ **需要信用卡验证**（不扣费）
- ⚠️ 配置稍复杂

**Railway** ⭐⭐
- ❌ 只有30天免费试用，之后需付费
- ❌ **需要信用卡**

---

## 📚 更多资源

- [Railway 文档](https://docs.railway.app)
- [Render 文档](https://render.com/docs)
- [Fly.io 文档](https://fly.io/docs)

---

## 💡 快速开始建议

### 🎯 没有信用卡？直接使用 Render！

**最简单流程**：

1. **访问 Render**（完全免费，无需信用卡）
   - 访问 [Render.com](https://render.com)
   - 用 GitHub 登录（无需信用卡！）
   - 按照上面的步骤部署
   - 配置持久化磁盘（重要！）

2. **解决休眠问题（可选）**
   - 注册 [UptimeRobot](https://uptimerobot.com)（完全免费，无需信用卡）
   - 添加监控，每 5 分钟访问一次你的网站
   - 这样服务就不会休眠了

3. **完成！**
   - 你的网站已经上线了
   - 可以分享给任何人访问

---

### 📋 部署检查清单

- [ ] 代码已推送到 GitHub
- [ ] 在 Render 创建了 Web Service
- [ ] 配置了环境变量（`NODE_ENV=production`, `PORT=10000`）
- [ ] **配置了持久化磁盘**（重要！否则数据库会丢失）
- [ ] 部署成功，可以访问网站
- [ ] （可选）配置了 UptimeRobot 避免休眠

---

**💡 提示**：
- ✅ **Render 完全免费，无需信用卡**
- ✅ 配置简单，5分钟即可完成部署
- ✅ 记得配置持久化磁盘，否则数据库会丢失
- ✅ 使用 UptimeRobot 可以避免服务休眠（也是免费的）

