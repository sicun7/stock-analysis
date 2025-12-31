// 获取API基础URL
export const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    // 如果是localhost或127.0.0.1，使用localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8887'
    }
    // 否则使用当前hostname（局域网IP）
    return `http://${hostname}:8887`
  }
  return 'http://localhost:8887'
}

