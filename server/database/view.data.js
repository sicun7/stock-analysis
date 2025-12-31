import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 数据库路径
const dbPath = join(__dirname, 'stock_data.db')

// 查看数据库数据
function viewData() {
  try {
    // 检查数据库是否存在
    if (!existsSync(dbPath)) {
      console.error('❌ 数据库文件不存在，请先运行 npm run init-db 初始化数据库')
      process.exit(1)
    }
    
    // 连接数据库
    const db = new Database(dbPath)
    
    // 获取表结构
    console.log('='.repeat(60))
    console.log('数据库表结构')
    console.log('='.repeat(60))
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='stock_data'").get()
    if (tableInfo) {
      console.log(tableInfo.sql)
    }
    console.log()
    
    // 获取总记录数
    const count = db.prepare('SELECT COUNT(*) as count FROM stock_data').get()
    console.log(`总记录数: ${count.count}`)
    console.log()
    
    // 获取前10条数据
    console.log('='.repeat(60))
    console.log('前 10 条数据')
    console.log('='.repeat(60))
    
    const rows = db.prepare('SELECT * FROM stock_data LIMIT 10').all()
    
    if (rows.length === 0) {
      console.log('数据库中没有数据')
    } else {
      // 获取列名
      const columns = Object.keys(rows[0])
      
      // 打印表头
      console.log(columns.join(' | '))
      console.log('-'.repeat(60))
      
      // 打印数据
      rows.forEach((row, index) => {
        const values = columns.map(col => {
          const value = row[col]
          if (value === null || value === undefined) return 'NULL'
          // 限制每列显示长度
          const str = String(value)
          return str.length > 20 ? str.substring(0, 17) + '...' : str
        })
        console.log(`${index + 1}. ${values.join(' | ')}`)
      })
    }
    
    console.log()
    
    // 显示所有列名
    console.log('='.repeat(60))
    console.log('所有列名')
    console.log('='.repeat(60))
    if (rows.length > 0) {
      const columns = Object.keys(rows[0])
      columns.forEach((col, index) => {
        console.log(`${index + 1}. ${col}`)
      })
    }
    
    // 关闭数据库连接
    db.close()
    
    console.log()
    console.log('✅ 查看完成!')
    console.log()
    console.log('提示: 可以使用 SQLite 命令行工具查看完整数据:')
    console.log(`  sqlite3 ${dbPath}`)
    console.log('  然后执行 SQL 查询，例如:')
    console.log('  SELECT * FROM stock_data LIMIT 20;')
    console.log('  .quit')
    
  } catch (error) {
    console.error('\n❌ 查看失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// 运行
viewData()

