# 多阶段构建 Dockerfile

# 阶段1：构建前端
FROM node:18-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装所有依赖（包括 devDependencies）
RUN npm ci

# 复制源代码
COPY . .

# 构建前端
RUN npm run build

# 阶段2：生产环境镜像
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
COPY --from=builder /app/ecosystem.config.js ./ecosystem.config.js

# 创建数据库目录
RUN mkdir -p server/database && \
    chmod -R 755 server/database

# 创建日志目录
RUN mkdir -p logs && \
    chmod -R 755 logs

# 暴露端口
EXPOSE 8888

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=8888

# 启动命令
CMD ["node", "server/api.js"]

