import express from 'express'
import cors from 'cors'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = 8887

// 数据库路径
const dbPath = join(__dirname, '..', 'database', 'stock_data.db')

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
function checkExists(db, date, code) {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM stock_data WHERE "T日" = ? AND "代码" = ?')
  const result = stmt.get(date, code)
  return result.count > 0
}

// 入库接口
app.post('/api/import', async (req, res) => {
  try {
    const { data } = req.body
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: '数据格式错误' })
    }
    
    // 连接数据库
    const db = new Database(dbPath)
    
    // 获取表结构，确定字段顺序
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='stock_data'").get()
    if (!tableInfo) {
      db.close()
      return res.status(500).json({ error: '数据库表不存在' })
    }
    
    // 获取所有列名（排除 id）
    const columns = db.prepare("PRAGMA table_info(stock_data)").all()
    const columnNames = columns
      .filter(col => col.name !== 'id')
      .map(col => col.name)
    
    // 准备插入语句（排除 id，id 是自增的）
    const placeholders = columnNames.map(() => '?').join(', ')
    const insertSQL = `INSERT INTO stock_data (${columnNames.map(name => `"${name}"`).join(', ')}) VALUES (${placeholders})`
    const insert = db.prepare(insertSQL)
    
    // 批量插入
    const insertMany = db.transaction((rows) => {
      let inserted = 0
      let skipped = 0
      
      if (rows.length === 0) {
        return { inserted: 0, skipped: 0 }
      }
      
      // 处理每一行数据
      // 前端传的数据行有35个字段（索引0-34），对应数据库的前35个字段（索引0-34）
      // 数据库第36个字段（索引35）需要计算：row[22] / row[21]
      // 注意：row[21]是第22项（从1开始计数），row[20]是第21项（从1开始计数）
      // 但用户说"第22项除以第21项"，应该是指索引21除以索引20
      const dividendIndex = 21  // 第22项（从1开始计数），索引21（从0开始计数）
      const divisorIndex = 20    // 第21项（从1开始计数），索引20（从0开始计数）
      
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex]
        
        // 检查是否存在（根据 T日 和 代码）
        // T日是第1个字段（索引0），代码是第2个字段（索引1）
        const date = row[0]
        const code = row[1]
        
        if (!date || !code) {
          console.log(`跳过行 ${rowIndex}: 日期或代码为空`, { date, code })
          skipped++
          continue
        }
        
        if (checkExists(db, date, code)) {
          console.log(`跳过行 ${rowIndex}: 数据已存在`, { date, code })
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
          console.error(`行 ${rowIndex} 参数数量不匹配: values.length=${values.length}, columnNames.length=${columnNames.length}`)
          console.error('row length:', row.length)
          console.error('row:', row)
          console.error('columnNames:', columnNames)
          skipped++
          continue
        }
        
        // 插入数据
        try {
          insert.run(...values)
          inserted++
          console.log(`成功插入行 ${rowIndex}:`, { date, code })
        } catch (err) {
          console.error(`插入行 ${rowIndex} 失败:`, err.message)
          console.error('values:', values)
          skipped++
        }
      }
      
      return { inserted, skipped }
    })
    
    const result = insertMany(data)
    
    db.close()
    
    res.json({
      success: true,
      inserted: result.inserted,
      skipped: result.skipped,
      total: data.length
    })
    
  } catch (error) {
    console.error('入库失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// 查询数据接口
app.get('/api/query', (req, res) => {
  try {
    // 连接数据库
    const db = new Database(dbPath)
    
    // 获取所有数据
    const rows = db.prepare('SELECT * FROM stock_data ORDER BY id').all()
    
    // 获取表结构，确定列名
    const columns = db.prepare("PRAGMA table_info(stock_data)").all()
    const columnNames = columns
      .filter(col => col.name !== 'id')
      .map(col => col.name)
    
    // 转换数据格式：将行数据转换为对象格式，使用列名作为键
    const data = rows.map(row => {
      const rowObj = {}
      columnNames.forEach((colName, index) => {
        rowObj[colName] = row[colName] !== null ? row[colName] : ''
      })
      return rowObj
    })
    
    db.close()
    
    res.json({
      success: true,
      headers: columnNames,
      data: data
    })
    
  } catch (error) {
    console.error('查询失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API 服务器运行在 http://localhost:${PORT}`)
})

