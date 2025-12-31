// PM2 进程管理配置文件
export default {
  apps: [{
    name: 'stock-api',
    script: 'server/api.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development',
      PORT: 8887  // 开发环境后端使用 8887，避免与前端 Vite 8888 冲突
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 8888
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    // 等待应用启动的时间（毫秒）
    listen_timeout: 10000,
    // 应用重启前的等待时间
    kill_timeout: 5000
  }]
}

