// 服务器配置文件

export const SERVER_CONFIG = {
  port: process.env.PORT || 8888,
  cors: {
    origin: '*', // 生产环境应该设置具体的域名
    credentials: true
  }
}

export const DB_CONFIG = {
  // 数据库路径相对于 server 目录
  path: 'database/stock_data.db'
}

