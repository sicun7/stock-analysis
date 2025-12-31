import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 数据库路径
const dbPath = join(__dirname, 'stock_data.db')

// 清空数据库（只删除数据，保留表结构）
function clearDatabase() {
  try {
    console.log('='.repeat(50))
    console.log('清空数据库数据（保留表结构）')
    console.log('='.repeat(50))
    console.log()
    
    if (!existsSync(dbPath)) {
      console.log('数据库文件不存在，无需清空')
      return
    }
    
    // 连接数据库
    const db = new Database(dbPath)
    
    // 检查表是否存在
    const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_data'").get()
    if (!tableInfo) {
      console.log('数据表不存在')
      db.close()
      return
    }
    
    // 获取当前记录数
    const countBefore = db.prepare('SELECT COUNT(*) as count FROM stock_data').get()
    console.log(`当前记录数: ${countBefore.count}`)
    
    // 删除所有数据（保留表结构）
    console.log('正在删除所有数据...')
    db.exec('DELETE FROM stock_data')
    console.log('✅ 数据已删除')
    
    // 重置自增ID（可选，让下次插入从1开始）
    console.log('正在重置自增ID...')
    db.exec("DELETE FROM sqlite_sequence WHERE name='stock_data'")
    console.log('✅ 自增ID已重置')
    
    // 验证删除结果
    const countAfter = db.prepare('SELECT COUNT(*) as count FROM stock_data').get()
    console.log(`删除后记录数: ${countAfter.count}`)
    
    // 关闭数据库连接
    db.close()
    
    console.log()
    console.log('✅ 数据库数据清空完成!（表结构已保留）')
    
  } catch (error) {
    console.error('\n❌ 清空失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// 运行
clearDatabase()

