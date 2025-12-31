// 前后端共享的常量

// API 端点
export const API_ENDPOINTS = {
  QUERY: '/api/query',
  IMPORT: '/api/import',
  KLINE: '/api/kline'
}

// 默认配置
export const DEFAULT_CONFIG = {
  API_PORT: 8888,
  API_BASE_URL: 'http://localhost:8888'
}


export const DB_ACCESS_CONFIG = {
  token:'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjcxNzUxNjYsImlkIjoiODk3NTllYzYtMDgwYS00NzRhLThlYzUtZTNlZDE2ODQ5ZjA2IiwicmlkIjoiMThhN2QxZDUtYjMzZC00YmRlLWJiZTQtNTU3Njk2OTE1NjJhIn0.OWTmu6WxBOJnhjoRceLkBZmm0Lz6uS3_ZMmg078vGgMNLjQ8VXFNiO18GD8S519k9zELNZorFs2uVwHGofLzCQ',
  url: 'libsql://stock-sicun7.aws-ap-northeast-1.turso.io'
}