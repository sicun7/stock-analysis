import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // 允许外部访问
    port: 8888, // 指定端口
    proxy: {
      // 代理所有 /api 请求到后端服务器
      // 开发环境：后端运行在 8887，前端通过代理访问（用户只需访问 8888）
      // 生产环境：后端运行在 8888，同时服务静态文件
      '/api': {
        target: 'http://localhost:8887',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
