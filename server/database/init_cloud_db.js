import Database from 'better-sqlite3'
import { createClient } from '@libsql/client'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import { DB_ACCESS_CONFIG } from '../../shared/constants.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 本地数据库路径
const localDbPath = join(__dirname, 'stock_data.db')

// 从 init.data.js 中获取表结构定义
const newColumnNames = [
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

const columnTypeMap = {
  'T日': 'TEXT',
  '代码': 'TEXT',
  '股票': 'TEXT',
  '现价_元': 'REAL',
  'T减1收盘价': 'REAL',
  'T减2的MA5': 'REAL',
  'T减2的MA10': 'REAL',
  'T减2的MA20': 'REAL',
  'T减1的MA5': 'REAL',
  'T减1的MA10': 'REAL',
  'T减1的MA20': 'REAL',
  'T的MA5': 'REAL',
  'T的MA10': 'REAL',
  'T的MA20': 'REAL',
  'T减1收盘价减MA5': 'REAL',
  'T减1涨幅': 'REAL',
  'T涨幅': 'REAL',
  'T最低价': 'REAL',
  'T最低价减MA5': 'REAL',
  'T减2成交量_股': 'TEXT',
  'T减1成交量_股': 'TEXT',
  'T成交量_股': 'TEXT',
  '涨跌幅': 'TEXT',
  'T减2的MA5减MA10': 'REAL',
  'T减1的MA5减MA10': 'REAL',
  'T的MA5减MA10': 'REAL',
  'T减2的MA10减MA20': 'REAL',
  'T减1的MA10减MA20': 'REAL',
  'T的MA10减MA20': 'REAL',
  'T减1开盘价': 'REAL',
  'T减1开盘价减MA5': 'REAL',
  'T减1成交量除T减2成交量': 'REAL',
  'T换手率': 'REAL',
  'T振幅': 'REAL',
  'T加1最大涨幅': 'REAL',
  'T成交量除T减1成交量': 'REAL'
}

// 连接 Turso 云数据库
function connectTurso() {
  console.log('正在连接 Turso 云数据库...')
  
  if (!DB_ACCESS_CONFIG.url || !DB_ACCESS_CONFIG.token) {
    throw new Error('Turso 连接配置不完整，请检查 shared/constants.js 中的 DB_ACCESS_CONFIG')
  }
  
  const client = createClient({
    url: DB_ACCESS_CONFIG.url,
    authToken: DB_ACCESS_CONFIG.token
  })
  
  console.log('✅ Turso 连接成功')
  return client
}

// 在云数据库中创建表
async function createCloudTable(client) {
  console.log('正在检查并创建云数据库表结构...')
  
  // 构建列定义
  const columnDefs = newColumnNames.map(colName => {
    const sqlType = columnTypeMap[colName] || 'TEXT'
    return `"${colName}" ${sqlType}`
  })
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS stock_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ${columnDefs.join(',\n      ')}
    )
  `
  
  await client.execute(createTableSQL)
  console.log('✅ 云数据库表结构创建/检查完成')
}

// 从本地数据库读取数据
function readLocalData() {
  console.log('正在读取本地数据库...')
  
  if (!existsSync(localDbPath)) {
    throw new Error(`本地数据库文件不存在: ${localDbPath}`)
  }
  
  const localDb = new Database(localDbPath)
  
  // 获取所有数据
  const data = localDb.prepare('SELECT * FROM stock_data ORDER BY id').all()
  
  console.log(`✅ 从本地数据库读取到 ${data.length} 条记录`)
  
  localDb.close()
  return data
}

// 同步数据到云数据库
async function syncDataToCloud(client, localData) {
  console.log('正在同步数据到云数据库...')
  
  // 先清空云数据库（可选，如果需要完全替换）
  console.log('正在清空云数据库现有数据...')
  await client.execute('DELETE FROM stock_data')
  console.log('✅ 云数据库已清空')
  
  // 准备插入语句（不包含 id，让数据库自动生成）
  const columns = newColumnNames.map(col => `"${col}"`).join(', ')
  const placeholders = newColumnNames.map(() => '?').join(', ')
  const insertSQL = `INSERT INTO stock_data (${columns}) VALUES (${placeholders})`
  
  // 批量插入数据
  const batchSize = 50 // Turso 建议较小的批次
  let synced = 0
  
  for (let i = 0; i < localData.length; i += batchSize) {
    const batch = localData.slice(i, i + batchSize)
    
    // 准备批量插入的语句
    const statements = batch.map(row => {
      // 按照列顺序构建值数组
      const values = newColumnNames.map(colName => {
        // 处理列名中的特殊字符（SQLite 列名可能包含中文和特殊字符）
        // 尝试直接获取，如果不存在则尝试其他可能的键名
        let value = row[colName]
        
        // 如果直接获取失败，尝试查找相似的键（处理可能的编码问题）
        if (value === undefined) {
          const keys = Object.keys(row)
          const matchedKey = keys.find(k => k === colName || k.includes(colName))
          if (matchedKey) {
            value = row[matchedKey]
          }
        }
        
        // 处理空值
        if (value === null || value === undefined || value === '') {
          return null
        }
        
        // 根据列类型转换值
        const sqlType = columnTypeMap[colName] || 'TEXT'
        if (sqlType === 'INTEGER' || sqlType === 'REAL') {
          const num = Number(value)
          return isNaN(num) ? null : num
        }
        
        return String(value)
      })
      
      return {
        sql: insertSQL,
        args: values
      }
    })
    
    // 使用 batch 方法批量执行
    await client.batch(statements)
    
    synced += batch.length
    process.stdout.write(`\r已同步 ${synced} / ${localData.length} 条记录`)
  }
  
  console.log('\n✅ 数据同步完成!')
}

// 验证同步结果
async function verifySync(client) {
  console.log('正在验证同步结果...')
  
  const result = await client.execute('SELECT COUNT(*) as count FROM stock_data')
  const count = result.rows[0].count
  
  console.log(`✅ 云数据库中现有 ${count} 条记录`)
  
  // 随机检查几条数据
  const sampleResult = await client.execute('SELECT id, "代码", "股票", "T日" FROM stock_data LIMIT 5')
  console.log('\n示例数据:')
  sampleResult.rows.forEach(row => {
    console.log(`  ID: ${row.id}, 代码: ${row['代码']}, 股票: ${row['股票']}, 日期: ${row['T日']}`)
  })
}

// 主函数
async function main() {
  try {
    console.log('='.repeat(50))
    console.log('本地数据库同步到 Turso 云数据库')
    console.log('='.repeat(50))
    console.log()
    
    // 1. 连接 Turso
    const client = connectTurso()
    
    // 2. 创建表结构
    await createCloudTable(client)
    
    // 3. 读取本地数据
    const localData = readLocalData()
    
    if (localData.length === 0) {
      console.log('⚠️  本地数据库为空，无需同步')
      return
    }
    
    // 4. 同步数据
    await syncDataToCloud(client, localData)
    
    // 5. 验证同步结果
    await verifySync(client)
    
    console.log('\n✅ 同步完成!')
    console.log(`云数据库 URL: ${DB_ACCESS_CONFIG.url}`)
    
  } catch (error) {
    console.error('\n❌ 同步失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// 运行主函数
main()

