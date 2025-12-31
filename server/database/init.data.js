import Database from 'better-sqlite3'
import * as XLSX from 'xlsx'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync, unlinkSync, readFileSync } from 'fs'

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 数据库和 Excel 文件路径
const dbPath = join(__dirname, 'stock_data.db')
const excelPath = join(__dirname, '..', '..', 'public', 'stock_data.xlsx')

// Excel 日期序列号转换为日期字符串
function excelDateToDateString(excelDate) {
  if (!excelDate && excelDate !== 0) return ''

  if (typeof excelDate === 'string' && (excelDate.includes('/') || excelDate.includes('-'))) {
    return excelDate
  }

  const numDate = Number(excelDate)
  if (isNaN(numDate)) {
    return String(excelDate)
  }

  const excelEpoch = new Date(1899, 11, 30)
  const days = Math.floor(numDate)
  const milliseconds = (numDate - days) * 24 * 60 * 60 * 1000
  const date = new Date(excelEpoch.getTime() + (days - 1) * 24 * 60 * 60 * 1000 + milliseconds)

  if (isNaN(date.getTime())) {
    return String(excelDate)
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

// 判断值是否为数字
function isNumeric(value) {
  if (value === '' || value === null || value === undefined) return false
  const num = Number(value)
  return !isNaN(num) && isFinite(num)
}

// 判断行是否为空
function isRowEmpty(row) {
  return row.every(val => val === '' || val === null || val === undefined)
}

// 解析股票列，提取代码和名称
// 输入格式: "2 富信科技688662.SH" 或类似格式
// 返回: { code: "688662.SH", name: "富信科技" }
function parseStockColumn(stockValue) {
  if (!stockValue || typeof stockValue !== 'string') {
    return { code: '', name: stockValue || '' }
  }
  
  // 匹配股票代码格式：数字.字母（如 688662.SH, 000001.SZ）
  const codeMatch = stockValue.match(/(\d{6}\.[A-Z]{2})/)
  
  if (codeMatch) {
    const code = codeMatch[1]
    // 提取代码前的部分作为股票名称
    // 去除开头的数字和空格（如 "2 "）
    let name = stockValue.substring(0, codeMatch.index).trim()
    // 去除开头的数字和空格
    name = name.replace(/^\d+\s*/, '').trim()
    
    return { code, name: name || stockValue }
  }
  
  // 如果没有匹配到代码，返回原值作为名称
  return { code: '', name: stockValue }
}

// 清理列名，使其适合作为 SQL 列名
function sanitizeColumnName(name) {
  // 先去除首尾空格
  let cleaned = name.trim()
  
  // 替换特殊字符为下划线，并确保以字母或下划线开头
  cleaned = cleaned
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_]/g, '_')
    .replace(/^[0-9]/, '_$&')
  
  // 去除首尾的下划线
  cleaned = cleaned.replace(/^_+|_+$/g, '')
  
  // 如果去除后为空，使用默认名称
  if (!cleaned) {
    cleaned = 'column_' + Math.random().toString(36).substring(2, 9)
  }
  
  return cleaned
}

// 检测列的数据类型
function detectColumnType(sampleValues) {
  if (sampleValues.length === 0) return 'TEXT'
  
  const numericCount = sampleValues.filter(val => isNumeric(val)).length
  const ratio = numericCount / sampleValues.length
  
  // 如果超过 50% 是数字，认为是数字类型
  if (ratio > 0.5) {
    // 检查是否有小数
    const hasDecimal = sampleValues.some(val => {
      const num = Number(val)
      return !isNaN(num) && !Number.isInteger(num)
    })
    return hasDecimal ? 'REAL' : 'INTEGER'
  }
  
  return 'TEXT'
}

// 初始化数据库
function initDatabase() {
  console.log('正在初始化数据库...')
  
  // 如果数据库已存在，先删除
  if (existsSync(dbPath)) {
    console.log('发现已存在的数据库，正在删除...')
    unlinkSync(dbPath)
  }
  
  // 创建数据库连接
  const db = new Database(dbPath)
  
  console.log('数据库创建成功:', dbPath)
  return db
}

// 读取 Excel 文件
function readExcelFile() {
  console.log('正在读取 Excel 文件...')
  
  if (!existsSync(excelPath)) {
    throw new Error(`Excel 文件不存在: ${excelPath}`)
  }
  
  // 读取 Excel 文件
  const fileBuffer = readFileSync(excelPath)
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
  
  // 获取第一个 sheet
  const firstSheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[firstSheetName]
  
  console.log(`读取 Sheet: ${firstSheetName}`)
  
  // 转换为 JSON 格式
  const jsonData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
    dateNF: 'yyyy-mm-dd'
  })
  
  if (jsonData.length === 0) {
    throw new Error('Excel 文件为空')
  }
  
  // 第一行作为表头
  const headerRow = jsonData[0]
  console.log(`发现 ${headerRow.length} 个列`)
  
  // 检查第一列是否是"T日"
  const isDateColumn = headerRow[0] === 'T日'
  
  // 从第二行开始是数据
  let dataRows = jsonData.slice(1).map((row, index) => {
    const rowObj = {}
    headerRow.forEach((header, colIndex) => {
      let cellValue = row[colIndex] !== undefined ? row[colIndex] : ''
      
      // 如果是第一列且是"T日"，尝试转换为日期格式
      if (colIndex === 0 && isDateColumn) {
        const cellAddress = XLSX.utils.encode_cell({ r: index + 1, c: colIndex })
        const cell = worksheet[cellAddress]
        
        if (cell) {
          if (cell.t === 'n' && cell.w) {
            cellValue = cell.w
          } else if (isNumeric(cellValue)) {
            cellValue = excelDateToDateString(cellValue)
          }
        } else if (isNumeric(cellValue)) {
          cellValue = excelDateToDateString(cellValue)
        }
      }
      
      rowObj[header] = cellValue
    })
    return rowObj
  })
  
  // 删除末尾的空白行
  dataRows = dataRows.filter(row => !isRowEmpty(Object.values(row)))
  
  console.log(`读取到 ${dataRows.length} 行数据`)
  
  // 处理"股票"列，解析代码和名称
  const stockColumnIndex = headerRow.findIndex(h => h.trim() === '股票')
  if (stockColumnIndex !== -1) {
    console.log('正在解析股票列，提取代码和名称...')
    
    // 在"T日"列后插入"代码"列
    const dateColumnIndex = headerRow.findIndex(h => h.trim() === 'T日')
    let codeColumnIndex = dateColumnIndex + 1
    
    // 如果"代码"列已存在，使用现有位置；否则插入新列
    let existingCodeIndex = headerRow.findIndex(h => h.trim() === '代码')
    if (existingCodeIndex === -1) {
      headerRow.splice(codeColumnIndex, 0, '代码')
      console.log('已在"T日"列后添加"代码"列')
    } else {
      codeColumnIndex = existingCodeIndex
      console.log('使用已存在的"代码"列')
    }
    
    // 处理每一行数据
    dataRows.forEach(row => {
      const stockValue = row['股票']
      const { code, name } = parseStockColumn(stockValue)
      
      // 更新股票名称为解析后的名称
      row['股票'] = name
      
      // 设置代码列的值
      row['代码'] = code
    })
    
    console.log('股票列解析完成')
  }
  
  return { headers: headerRow, data: dataRows }
}

// 新的字段名定义（固定字段名）
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

// 旧字段名到新字段名的映射
const columnNameMapping = {
  'T日': 'T日',
  '代码': '代码',
  '股票': '股票',
  '现价_元': '现价_元',
  'T_1收盘价': 'T减1收盘价',
  'T_2_MA5': 'T减2的MA5',
  'T_2_MA10': 'T减2的MA10',
  'T_2_MA20': 'T减2的MA20',
  'T_1_MA5': 'T减1的MA5',
  'T_1_MA10': 'T减1的MA10',
  'T_1_MA20': 'T减1的MA20',
  'T_MA5': 'T的MA5',
  'T_MA10': 'T的MA10',
  'T_MA20': 'T的MA20',
  'T_1收盘价_MA5': 'T减1收盘价减MA5',
  'T_1涨幅': 'T减1涨幅',
  'T涨幅': 'T涨幅',
  'T最低价': 'T最低价',
  'T最低价_MA5': 'T最低价减MA5',
  'T_2成交量_股': 'T减2成交量_股',
  'T_1成交量_股': 'T减1成交量_股',
  'T成交量_股': 'T成交量_股',
  '涨跌幅': '涨跌幅',
  'T_2的MA5_MA10': 'T减2的MA5减MA10',
  'T_1的MA5_MA10': 'T减1的MA5减MA10',
  'T的MA5_MA10': 'T的MA5减MA10',
  'T_2的MA10_MA20': 'T减2的MA10减MA20',
  'T_1的MA10_MA20': 'T减1的MA10减MA20',
  'T的MA10_MA20': 'T的MA10减MA20',
  'T_1开盘价': 'T减1开盘价',
  'T_1的开盘价_MA5': 'T减1开盘价减MA5',
  'T_1成交量_T_2成交量': 'T减1成交量除T减2成交量',
  'T换手率': 'T换手率',
  'T振幅': 'T振幅',
  'T_1的最大涨幅': 'T加1最大涨幅',
  'T成交量_T_1成交量': 'T成交量除T减1成交量'
}

// 字段类型定义（根据新字段名）
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

// 创建数据表
function createTable(db, headers, dataRows, columnTypes) {
  console.log('正在创建数据表...')
  
  // 使用新的固定字段名
  const columnDefs = newColumnNames.map(colName => {
    const sqlType = columnTypeMap[colName] || 'TEXT'
    return `"${colName}" ${sqlType}`
  })
  
  // 添加 id 主键
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS stock_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ${columnDefs.join(',\n      ')}
    )
  `
  
  db.exec(createTableSQL)
  console.log('数据表创建成功')
  
  return { sanitizedHeaders: newColumnNames }
}

// 导入数据
function importData(db, headers, sanitizedHeaders, dataRows, columnTypes) {
  console.log('正在导入数据...')
  
  // 创建旧字段名到新字段名的映射（基于 headers 的顺序）
  const headerToNewColumnMap = {}
  headers.forEach((oldHeader, index) => {
    // 尝试从映射表获取新字段名，如果没有则使用旧字段名
    const newColumnName = columnNameMapping[oldHeader] || newColumnNames[index] || oldHeader
    headerToNewColumnMap[oldHeader] = newColumnName
  })
  
  // 准备插入语句（使用新的固定字段名）
  const placeholders = newColumnNames.map(() => '?').join(', ')
  const insertSQL = `
    INSERT INTO stock_data (${newColumnNames.map(h => `"${h}"`).join(', ')})
    VALUES (${placeholders})
  `
  
  const insert = db.prepare(insertSQL)
  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      // 按照新字段名顺序构建值数组
      const values = newColumnNames.map(newColName => {
        // 找到对应的旧字段名
        const oldHeader = Object.keys(headerToNewColumnMap).find(
          oldH => headerToNewColumnMap[oldH] === newColName
        )
        
        let value = oldHeader ? row[oldHeader] : null
        
        // 处理空值
        if (value === null || value === undefined || value === '') {
          return null
        }
        
        // 根据列类型转换值（使用新字段名的类型定义）
        const sqlType = columnTypeMap[newColName] || 'TEXT'
        if (sqlType === 'INTEGER' || sqlType === 'REAL') {
          const num = Number(value)
          return isNaN(num) ? null : num
        }
        
        return String(value)
      })
      
      insert.run(...values)
    }
  })
  
  // 批量插入数据
  const batchSize = 100
  let imported = 0
  
  for (let i = 0; i < dataRows.length; i += batchSize) {
    const batch = dataRows.slice(i, i + batchSize)
    insertMany(batch)
    imported += batch.length
    process.stdout.write(`\r已导入 ${imported} / ${dataRows.length} 行数据`)
  }
  
  console.log('\n数据导入完成!')
}

// 主函数
function main() {
  try {
    console.log('='.repeat(50))
    console.log('股票数据数据库初始化脚本')
    console.log('='.repeat(50))
    console.log()
    
    // 初始化数据库
    const db = initDatabase()
    
    // 读取 Excel 文件
    const { headers, data: dataRows } = readExcelFile()
    
    // 创建数据表（需要先检测列类型）
    const columnTypes = {}
    headers.forEach((header, colIndex) => {
      const sampleValues = dataRows
        .slice(0, Math.min(100, dataRows.length))
        .map(row => row[header])
        .filter(val => val !== '' && val !== null && val !== undefined)
      
      columnTypes[header] = detectColumnType(sampleValues)
    })
    
    const { sanitizedHeaders } = createTable(db, headers, dataRows, columnTypes)
    
    // 导入数据
    importData(db, headers, sanitizedHeaders, dataRows, columnTypes)
    
    // 显示统计信息
    const count = db.prepare('SELECT COUNT(*) as count FROM stock_data').get()
    console.log(`\n数据库初始化完成!`)
    console.log(`总记录数: ${count.count}`)
    console.log(`数据库文件: ${dbPath}`)
    
    // 关闭数据库连接
    db.close()
    
    console.log('\n✅ 初始化成功!')
    
  } catch (error) {
    console.error('\n❌ 初始化失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// 运行主函数
main()

