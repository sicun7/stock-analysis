// 获取API基础URL
export const getApiBaseUrl = () => {
  // 开发环境：使用相对路径，通过 Vite 代理
  if (import.meta.env.DEV) {
    return ''
  }
  
  // 生产环境：使用完整 URL
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    const port = window.location.port || '8888'
    // 使用当前页面的协议和端口
    return `${window.location.protocol}//${hostname}:${port}`
  }
  return 'http://localhost:8888'
}

