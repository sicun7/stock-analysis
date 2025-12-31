# Render 快速部署指南（5分钟上手）

**✅ 完全免费，无需信用卡！**

## 🚀 超简单步骤

### 1. 准备代码（如果还没推送到 GitHub）

```bash
# 确保代码已提交
git add .
git commit -m "准备部署到 Render"
git push origin main
```

### 2. 注册 Render（1分钟）

1. 访问：https://render.com
2. 点击 "Get Started for Free"
3. 选择 "Sign up with GitHub"
4. 授权 GitHub 账号
5. **✅ 无需信用卡！完全免费！**

### 3. 创建 Web Service（2分钟）

1. 登录后，点击 **"New +"** → **"Web Service"**
2. 点击 **"Connect account"** 连接 GitHub（如果还没连接）
3. 选择你的仓库：`stock-analysis`
4. 填写配置：

   - **Name**: `stock-analysis`（或任意名称）
   - **Region**: `Singapore`（或离你最近的）
   - **Branch**: `main`
   - **Root Directory**: 留空
   - **Runtime**: `Docker`（推荐）或 `Node`
   - **Plan**: `Free`

5. 点击 **"Create Web Service"**

### 4. 配置环境变量（30秒）

在服务创建后：

1. 点击 **"Environment"** 标签页
2. 添加环境变量：
   ```
   NODE_ENV = production
   PORT = 10000
   ```
3. 点击 **"Save Changes"**

### 5. 配置持久化磁盘（重要！1分钟）

**这一步很重要，否则数据库会丢失！**

1. 点击 **"Disks"** 标签页
2. 点击 **"Link Disk"**
3. 填写：
   - **Name**: `database`
   - **Mount Path**: `/opt/render/project/src/server/database`
   - **Size**: `1` GB
4. 点击 **"Link Disk"**

### 6. 等待部署（2-5分钟）

Render 会自动：
- 克隆代码
- 构建 Docker 镜像（如果选择 Docker）
- 启动服务

在 **"Events"** 标签页可以看到部署进度。

### 7. 获取访问地址

部署完成后，在服务页面顶部会显示你的网址：
```
https://your-app-name.onrender.com
```

点击这个链接即可访问！

---

## ✅ 部署完成检查

访问你的网站，检查：

- [ ] 首页能正常加载
- [ ] 可以查询股票数据
- [ ] 可以导入数据
- [ ] 数据能正常保存（刷新后还在）

---

## 🔧 解决休眠问题（可选）

Render 免费计划会在 15 分钟无活动后休眠。首次访问需要等待 30 秒左右启动。

**解决方案：使用 UptimeRobot 保持活跃**

1. 注册 [UptimeRobot](https://uptimerobot.com)（免费）
2. 添加监控：
   - **Monitor Type**: HTTP(s)
   - **URL**: 你的 Render 网址
   - **Monitoring Interval**: 5 minutes
3. 保存后，UptimeRobot 会每 5 分钟访问一次你的网站
4. 这样服务就不会休眠了！

---

## 🐛 常见问题

### Q: 部署失败怎么办？

**A**: 检查：
1. 代码是否已推送到 GitHub
2. `Dockerfile` 是否存在且正确
3. 查看 "Events" 标签页的错误信息

### Q: 数据库数据丢失了？

**A**: 检查是否配置了持久化磁盘（Disks）。如果没有配置，每次重启数据会丢失。

### Q: 访问很慢？

**A**: 
1. 首次访问需要等待服务启动（30秒左右）
2. 如果服务休眠了，需要等待启动
3. 使用 UptimeRobot 可以避免休眠

### Q: 如何更新代码？

**A**: 
1. 推送新代码到 GitHub
2. Render 会自动检测并重新部署
3. 在 "Events" 标签页可以看到部署进度

---

## 📝 重要提示

1. ✅ **必须配置持久化磁盘**，否则数据库会丢失
2. ✅ 环境变量 `PORT=10000` 必须设置（Render 使用动态端口）
3. ✅ 首次部署需要 5-10 分钟，请耐心等待
4. ✅ 使用 UptimeRobot 可以避免服务休眠

---

## 🎉 完成！

现在你的项目已经部署到互联网上了！

访问地址：`https://your-app-name.onrender.com`

可以分享给任何人访问！

