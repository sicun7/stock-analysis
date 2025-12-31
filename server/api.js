import express from 'express'
import cors from 'cors'
import { createClient } from '@libsql/client'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import https from 'https'
import http from 'http'
import { DB_ACCESS_CONFIG } from '../shared/constants.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
// 开发环境使用 8887（避免与前端 Vite 8888 冲突），生产环境使用 8888
// 用户只需访问 8888，开发环境通过 Vite 代理访问后端
const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 8888 : 8887)

// 连接 Turso 云数据库
const db = createClient({
  url: DB_ACCESS_CONFIG.url,
  authToken: DB_ACCESS_CONFIG.token
})

// 已知的列名（从 init.data.js 中获取）
const columnNames = [
  'T日',
  '代码',
  '股票',
  '现价_元',
  'T减1收盘价',
  'T减2的MA5',
  'T减2的MA10',
  'T减2的MA20',
  'T减1的MA5',
  'T减1的MA10',
  'T减1的MA20',
  'T的MA5',
  'T的MA10',
  'T的MA20',
  'T减1收盘价减MA5',
  'T减1涨幅',
  'T涨幅',
  'T最低价',
  'T最低价减MA5',
  'T减2成交量_股',
  'T减1成交量_股',
  'T成交量_股',
  '涨跌幅',
  'T减2的MA5减MA10',
  'T减1的MA5减MA10',
  'T的MA5减MA10',
  'T减2的MA10减MA20',
  'T减1的MA10减MA20',
  'T的MA10减MA20',
  'T减1开盘价',
  'T减1开盘价减MA5',
  'T减1成交量除T减2成交量',
  'T换手率',
  'T振幅',
  'T加1最大涨幅',
  'T成交量除T减1成交量'
]

// 中间件
app.use(cors())
app.use(express.json())

// 将中文数字格式转换为数值（如 "509.87万" -> 5098700, "2.46亿" -> 246000000）
function convertChineseNumber(str) {
  if (!str || typeof str !== 'string') return null
  
  const trimmed = str.trim()
  if (!trimmed) return null
  
  // 移除可能的逗号
  const cleaned = trimmed.replace(/,/g, '')
  
  // 匹配数字和单位
  const match = cleaned.match(/^([\d.]+)([万亿])?$/)
  if (!match) {
    // 如果不是中文格式，尝试直接转换为数字
    const num = parseFloat(cleaned)
    return isNaN(num) ? null : num
  }
  
  const num = parseFloat(match[1])
  const unit = match[2]
  
  if (isNaN(num)) return null
  
  if (unit === '万') {
    return num * 10000
  } else if (unit === '亿') {
    return num * 100000000
  }
  
  return num
}

// 计算 T成交量_股 / T_1成交量_股
function calculateVolumeRatio(tVolume, t1Volume) {
  const tVol = convertChineseNumber(tVolume)
  const t1Vol = convertChineseNumber(t1Volume)
  
  if (tVol === null || t1Vol === null || t1Vol === 0) {
    return null
  }
  
  return parseFloat((tVol / t1Vol).toFixed(2))
}

// 检查数据是否存在（根据 T日 和 代码）
// 注意：字段名已经改为新名称，但T日和代码字段名保持不变
async function checkExists(date, code) {
  const result = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM stock_data WHERE "T日" = ? AND "代码" = ?',
    args: [date, code]
  })
  return result.rows[0].count > 0
}

// 入库接口
app.post('/api/import', async (req, res) => {
  try {
    const { data } = req.body
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: '数据格式错误' })
    }
    
    // 准备插入语句（排除 id，id 是自增的）
    const placeholders = columnNames.map(() => '?').join(', ')
    const insertSQL = `INSERT INTO stock_data (${columnNames.map(name => `"${name}"`).join(', ')}) VALUES (${placeholders})`
    
    // 批量插入
    let inserted = 0
    let skipped = 0
    
    if (data.length === 0) {
      return res.json({
        success: true,
        inserted: 0,
        skipped: 0,
        total: 0
      })
    }
    
    // 处理每一行数据
    // 前端传的数据行有35个字段（索引0-34），对应数据库的前35个字段（索引0-34）
    // 数据库第36个字段（索引35）需要计算：row[22] / row[21]
    const dividendIndex = 21  // 第22项（从1开始计数），索引21（从0开始计数）
    const divisorIndex = 20    // 第21项（从1开始计数），索引20（从0开始计数）
    
    // 准备批量插入的语句
    const statements = []
    
    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex]
      
      // 检查是否存在（根据 T日 和 代码）
      // T日是第1个字段（索引0），代码是第2个字段（索引1）
      const date = row[0]
      const code = row[1]
      
      if (!date || !code) {
        skipped++
        continue
      }
      
      // 检查是否已存在
      if (await checkExists(date, code)) {
        skipped++
        continue
      }
      
      // 构建插入值数组，按照数据库字段顺序
      const values = []
      
      // 前35个字段：直接按顺序对应（row[0] 到 row[34] 对应数据库字段索引 0-34）
      for (let i = 0; i < 35 && i < row.length; i++) {
        let value = row[i]
        
        // 处理空值
        if (value === null || value === undefined || value === '') {
          values.push(null)
        } else {
          // T日（索引0）和代码（索引1）必须保持为字符串
          if (i === 0 || i === 1) {
            values.push(String(value))
          } else {
            // 其他字段：尝试转换为数字（如果是数字列）
            const num = parseFloat(value)
            if (!isNaN(num) && isFinite(num)) {
              values.push(num)
            } else {
              values.push(String(value))
            }
          }
        }
      }
      
      // 如果row只有35个字段，但我们需要36个字段，补齐到35个
      while (values.length < 35) {
        values.push(null)
      }
      
      // 第36个字段：计算 row[22] / row[21]（即索引21除以索引20）
      const dividend = dividendIndex < row.length ? row[dividendIndex] : null  // 第22项（索引21）
      const divisor = divisorIndex < row.length ? row[divisorIndex] : null       // 第21项（索引20）
      
      const volumeRatio = calculateVolumeRatio(dividend, divisor)
      values.push(volumeRatio)
      
      // 确保 values 长度等于 columnNames 长度
      if (values.length !== columnNames.length) {
        skipped++
        continue
      }
      
      // 添加到批量插入列表
      statements.push({
        sql: insertSQL,
        args: values
      })
    }
    
    // 批量执行插入（每批50条）
    const batchSize = 50
    for (let i = 0; i < statements.length; i += batchSize) {
      const batch = statements.slice(i, i + batchSize)
      await db.batch(batch)
      inserted += batch.length
    }
    
    res.json({
      success: true,
      inserted: inserted,
      skipped: skipped,
      total: data.length
    })
    
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 查询数据接口
app.get('/api/query', async (req, res) => {
  try {
    // 获取所有数据
    const result = await db.execute('SELECT * FROM stock_data ORDER BY id')
    const rows = result.rows
    
    // 转换数据格式：将行数据转换为对象格式，使用列名作为键
    const data = rows.map(row => {
      const rowObj = {}
      columnNames.forEach((colName) => {
        rowObj[colName] = row[colName] !== null && row[colName] !== undefined ? row[colName] : ''
      })
      return rowObj
    })
    
    res.json({
      success: true,
      headers: columnNames,
      data: data
    })
    
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 获取K线数据接口
app.get('/api/kline', async (req, res) => {
  try {
    const { code, type } = req.query

    if (!code) {
      return res.status(400).json({ success: false, error: '股票代码不能为空' })
    }

    // 根据类型确定周期参数
    // scale: 5, 15, 30, 60, 240, 1440 (分钟)
    // 分时: 5分钟K线
    // 日K: 240分钟K线（4小时，实际是日K）
    // 月K: 需要特殊处理
    // 年K: 需要特殊处理
    let scale = 240 // 默认日K
    let datalen = 240 // 数据量

    switch (type) {
      case 'minute':
        scale = 5
        datalen = 50 // 一天大约48条5分钟K线，50条足够
        break
      case 'day':
        scale = 240
        datalen = 240
        break
      case 'week':
        scale = 1440 // 日K，然后聚合处理成周K
        datalen = 500 // 需要足够的数据来聚合周K
        break
      case 'month':
        scale = 1440 // 日K，然后聚合处理成月K
        datalen = 200
        break
      default:
        scale = 240
        datalen = 240
    }

    // 新浪财经API
    const url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${code}&scale=${scale}&ma=no&datalen=${datalen}`

    await new Promise((resolve, reject) => {
      https.get(url, (response) => {
        let data = ''

        response.on('data', (chunk) => {
          data += chunk
        })

        response.on('end', () => {
          try {
            // 新浪返回的是JSON数组格式
            const klineData = JSON.parse(data)

            if (!Array.isArray(klineData) || klineData.length === 0) {
              res.json({
                success: false,
                error: '未获取到数据，请检查股票代码是否正确'
              })
              return resolve()
            }

            // 转换数据格式
            const formattedData = klineData.map((item, index) => {
              // 新浪返回格式: {day: "2024-01-01", open: "10.00", high: "10.50", low: "9.80", close: "10.20", volume: "1000000"}
              const timestamp = new Date(item.day).getTime()
              
              return {
                timestamp: timestamp,
                open: parseFloat(item.open) || 0,
                high: parseFloat(item.high) || 0,
                low: parseFloat(item.low) || 0,
                close: parseFloat(item.close) || 0,
                volume: parseFloat(item.volume) || 0
              }
            })

            // 如果是分时图，只返回当天的数据
            let filteredData = formattedData
            if (type === 'minute') {
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              const todayStart = today.getTime()
              const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1
              
              filteredData = formattedData.filter(item => {
                return item.timestamp >= todayStart && item.timestamp < todayEnd
              })
            }

            // 如果是周K或月K，需要聚合数据
            let finalData = filteredData
            if (type === 'week' || type === 'month') {
              finalData = aggregateKLineData(filteredData, type)
            }

            res.json({
              success: true,
              data: finalData
            })
            resolve()
          } catch (parseError) {
            res.status(500).json({
              success: false,
              error: '数据解析失败: ' + parseError.message
            })
            resolve()
          }
        })
      }).on('error', (error) => {
        res.status(500).json({
          success: false,
          error: '获取数据失败: ' + error.message
        })
        resolve()
      })
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 聚合K线数据（用于周K和月K）
function aggregateKLineData(data, type) {
  if (!data || data.length === 0) return []

  const aggregated = []
  const grouped = {}

  data.forEach(item => {
    const date = new Date(item.timestamp)
    let key

    if (type === 'week') {
      // 按周分组：获取该日期所在周的周一作为key
      const dayOfWeek = date.getDay()
      const monday = new Date(date)
      monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      monday.setHours(0, 0, 0, 0)
      // 使用周一的日期作为key：YYYY-MM-DD
      key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
    } else if (type === 'month') {
      // 按月分组：YYYY-MM
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    } else {
      return
    }

    if (!grouped[key]) {
      // 对于周K，使用该周周一的时间戳；对于月K，使用该月第一天的时间戳
      let aggregatedTimestamp = item.timestamp
      if (type === 'week') {
        const dayOfWeek = date.getDay()
        const monday = new Date(date)
        monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
        monday.setHours(0, 0, 0, 0)
        aggregatedTimestamp = monday.getTime()
      } else if (type === 'month') {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
        firstDay.setHours(0, 0, 0, 0)
        aggregatedTimestamp = firstDay.getTime()
      }
      
      grouped[key] = {
        timestamp: aggregatedTimestamp,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume
      }
    } else {
      // 更新最高价、最低价、收盘价和成交量
      grouped[key].high = Math.max(grouped[key].high, item.high)
      grouped[key].low = Math.min(grouped[key].low, item.low)
      grouped[key].close = item.close // 使用最后一个收盘价
      grouped[key].volume += item.volume
    }
  })

  // 转换为数组并按时间排序
  Object.values(grouped).forEach(item => {
    aggregated.push(item)
  })

  aggregated.sort((a, b) => a.timestamp - b.timestamp)

  return aggregated
}

// 生产环境：服务静态文件（前端构建产物）
if (process.env.NODE_ENV === 'production') {
  const distPath = join(__dirname, '..', 'dist')
  
  // 服务静态文件
  app.use(express.static(distPath))
  
  // SPA 路由回退：所有非 API 请求返回 index.html
  app.get('*', (req, res, next) => {
    // 如果是 API 请求，跳过
    if (req.path.startsWith('/api')) {
      return next()
    }
    res.sendFile(join(distPath, 'index.html'))
  })
}

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://localhost:${PORT}`)
  if (process.env.NODE_ENV === 'production') {
    console.log('生产模式：已启用静态文件服务')
  }
})

