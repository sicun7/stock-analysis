import { useState, useEffect, useRef } from 'react'

// 获取API基础URL
const getApiBaseUrl = () => {
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

function HtmlParser() {
  const [htmlInput, setHtmlInput] = useState('')
  const [parsedData, setParsedData] = useState([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const parseTimeoutRef = useRef(null)

  // 解析股票列，提取代码和名称
  // 输入格式: "2 富信科技688662.SH" 或类似格式
  // 返回: { code: "688662.SH", name: "富信科技" }
  const parseStockColumn = (stockValue) => {
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

  // 将中文日期格式转换为 YYYY-MM-DD 格式
  // 例如："9月8日" -> "2025-09-08"
  const convertChineseDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return dateStr
    
    // 匹配 "X月X日" 格式
    const match = dateStr.match(/(\d{1,2})月(\d{1,2})日/)
    if (match) {
      const month = parseInt(match[1], 10)
      const day = parseInt(match[2], 10)
      const currentYear = new Date().getFullYear()
      return `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
    
    return dateStr
  }

  // 处理表格数据，在"T日"列后添加"代码"列，并解析股票列
  const processStockColumn = (tableData) => {
    if (tableData.length === 0) return tableData
    
    // 查找"T日"列和"股票"列的索引
    const headerRow = tableData[0]
    const dateColumnIndex = headerRow.findIndex(cell => cell.trim() === 'T日' || cell.trim() === '日期')
    const stockColumnIndex = headerRow.findIndex(cell => cell.trim() === '股票')
    
    // 如果找不到"T日"或"股票"列，直接返回原数据
    if (dateColumnIndex === -1 || stockColumnIndex === -1) {
      return tableData
    }
    
    // 检查"代码"列是否已存在
    let codeColumnIndex = headerRow.findIndex(cell => cell.trim() === '代码')
    
    // 如果"代码"列不存在，在"T日"列后插入
    if (codeColumnIndex === -1) {
      codeColumnIndex = dateColumnIndex + 1
      // 在表头插入"代码"列
      headerRow.splice(codeColumnIndex, 0, '代码')
      
      // 更新股票列的索引（如果代码列在股票列之前）
      const newStockColumnIndex = stockColumnIndex < codeColumnIndex ? stockColumnIndex : stockColumnIndex + 1
      
      // 处理每一行数据（跳过表头）
      return tableData.map((row, rowIndex) => {
        if (rowIndex === 0) {
          // 表头行，已经处理过了
          return row
        }
        
        // 复制行数据
        const newRow = [...row]
        
        // 获取股票列的值（使用原始索引）
        const stockValue = newRow[stockColumnIndex] || ''
        
        // 解析股票列
        const { code, name } = parseStockColumn(stockValue)
        
        // 在"T日"列后插入代码值
        newRow.splice(codeColumnIndex, 0, code)
        
        // 更新股票列的值为解析后的名称（注意索引可能已变化）
        const updatedStockIndex = stockColumnIndex < codeColumnIndex ? stockColumnIndex : stockColumnIndex + 1
        newRow[updatedStockIndex] = name
        
        // 转换日期格式（如果日期列存在）
        const updatedDateIndex = dateColumnIndex < codeColumnIndex ? dateColumnIndex : dateColumnIndex + 1
        if (updatedDateIndex < newRow.length && newRow[updatedDateIndex]) {
          newRow[updatedDateIndex] = convertChineseDate(newRow[updatedDateIndex])
        }
        
        return newRow
      })
    } else {
      // "代码"列已存在，只需要更新股票列和代码列的值
      return tableData.map((row, rowIndex) => {
        if (rowIndex === 0) {
          // 表头行，不需要处理
          return row
        }
        
        // 复制行数据
        const newRow = [...row]
        
        // 获取股票列的值
        const stockValue = newRow[stockColumnIndex] || ''
        
        // 解析股票列
        const { code, name } = parseStockColumn(stockValue)
        
        // 更新代码列和股票列
        newRow[codeColumnIndex] = code
        newRow[stockColumnIndex] = name
        
        // 转换日期格式（如果日期列存在）
        if (dateColumnIndex < newRow.length && newRow[dateColumnIndex]) {
          newRow[dateColumnIndex] = convertChineseDate(newRow[dateColumnIndex])
        }
        
        return newRow
      })
    }
  }

  const parseHtmlTable = (html) => {
    try {
      // 创建临时DOM来解析HTML
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      
      // 查找所有表格
      const tables = doc.querySelectorAll('table')
      
      if (tables.length === 0) {
        throw new Error('未找到表格数据')
      }
      
      // 解析所有表格的原始数据
      const rawTables = []
      tables.forEach((table, tableIndex) => {
        const rows = table.querySelectorAll('tr')
        const tableData = []
        
        rows.forEach((row) => {
          const cells = row.querySelectorAll('th, td')
          const rowData = []
          
          cells.forEach((cell) => {
            // 获取单元格文本，去除空白字符
            let text = cell.textContent || cell.innerText || ''
            text = text.trim().replace(/\s+/g, ' ')
            
            // 如果文本为空，尝试获取其他属性
            if (!text) {
              text = cell.getAttribute('data-value') || cell.getAttribute('value') || ''
            }
            
            rowData.push(text)
          })
          
          // 只添加有数据的行
          if (rowData.length > 0 && rowData.some(cell => cell.trim() !== '')) {
            tableData.push(rowData)
          }
        })
        
        if (tableData.length > 0) {
          rawTables.push(tableData)
        }
      })
      
      if (rawTables.length === 0) {
        throw new Error('表格中没有有效数据')
      }
      
      // 过滤掉指定列的函数
      const filterColumns = (data) => {
        if (data.length === 0) return data
        
        // 在第一行（表头）中查找要删除的列索引
        const headerRow = data[0]
        const columnsToRemove = []
        
        headerRow.forEach((cell, index) => {
          const cellText = cell.trim()
          if (cellText === '所属概念' || cellText === '股票市场类型') {
            columnsToRemove.push(index)
          }
        })
        
        // 如果没有找到要删除的列，直接返回
        if (columnsToRemove.length === 0) return data
        
        // 从所有行中删除这些列（从后往前删除，避免索引变化）
        return data.map(row => {
          const newRow = [...row]
          columnsToRemove.sort((a, b) => b - a).forEach(index => {
            newRow.splice(index, 1)
          })
          return newRow
        })
      }
      
      // 从列头文本中提取日期并格式化
      const extractDateFromHeader = (headerText) => {
        if (!headerText) return ''
        
        // 匹配日期格式：YYYY.MM.DD 或 YYYY-MM-DD
        const dateMatch = headerText.match(/(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})/)
        if (dateMatch) {
          const year = parseInt(dateMatch[1], 10)
          const month = parseInt(dateMatch[2], 10)
          const day = parseInt(dateMatch[3], 10)
          return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        }
        
        // 如果匹配不到，尝试匹配 "X月X日" 格式，转换为 "YYYY-MM-DD"（默认使用2025年）
        const chineseDateMatch = headerText.match(/(\d{1,2})月(\d{1,2})日/)
        if (chineseDateMatch) {
          const month = parseInt(chineseDateMatch[1], 10)
          const day = parseInt(chineseDateMatch[2], 10)
          const currentYear = new Date().getFullYear()
          return `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        }
        
        return ''
      }
      
      // 如果检测到2个表格，将表格2作为第一列合并到表格1
      if (rawTables.length === 2) {
        const table1 = rawTables[0]
        const table2 = rawTables[1] // 第一列数据
        
        // 从表格1的倒数第二列列头中提取日期
        let dateValue = ''
        if (table1.length > 0 && table1[0].length >= 2) {
          const secondLastColumnIndex = table1[0].length - 2
          const headerText = table1[0][secondLastColumnIndex] || ''
          dateValue = extractDateFromHeader(headerText)
        }
        
        // 确定最大行数，确保所有数据都被处理
        const maxRows = Math.max(table1.length, table2.length)
        
        // 合并数据：将日期、表格2数据、表格1数据合并
        const mergedData = []
        for (let index = 0; index < maxRows; index++) {
          // 获取表格2对应行的所有列数据
          let firstColumnData = ''
          if (table2[index] && table2[index].length > 0) {
            // 如果表格2有数据，取所有列（可能有多列，用空格连接）
            firstColumnData = table2[index].filter(cell => cell.trim()).join(' ').trim()
          }
          
          // 获取表格1对应行的数据
          const table1Row = table1[index] || []
          
          // 将日期、表格2数据、表格1数据合并（日期在最前面）
          // 如果是表头行（index === 0），日期列显示"日期"，否则显示提取的日期值
          const dateColumn = index === 0 ? '日期' : dateValue
          mergedData.push([dateColumn, firstColumnData, ...table1Row])
        }
        
        // 过滤掉"所属概念"和"股票市场类型"列
        const filteredData = filterColumns(mergedData)
        
        // 处理股票列，解析代码和名称
        const processedData = processStockColumn(filteredData)
        
        return [{
          tableIndex: 1,
          data: processedData,
          isMerged: true
        }]
      }
      
      // 如果只有1个表格或多个表格（>2），按原样返回，但也需要过滤列
      const filteredTables = rawTables.map((tableData, index) => ({
        tableIndex: index + 1,
        data: filterColumns(tableData)
      }))
      
      // 处理每个表格的股票列
      return filteredTables.map(table => ({
        ...table,
        data: processStockColumn(table.data)
      }))
    } catch (err) {
      throw new Error(`解析失败: ${err.message}`)
    }
  }

  const handleParse = () => {
    setError('')
    setParsedData([])
    setCopied(false)
    
    if (!htmlInput.trim()) {
      setError('请输入HTML代码')
      return
    }
    
    try {
      const data = parseHtmlTable(htmlInput)
      setParsedData(data)
    } catch (err) {
      setError(err.message)
    }
  }

  // 自动解析：当输入内容变化时，延迟500ms后自动触发解析
  useEffect(() => {
    // 清除之前的定时器
    if (parseTimeoutRef.current) {
      clearTimeout(parseTimeoutRef.current)
    }
    
    // 如果输入为空，清空结果
    if (!htmlInput.trim()) {
      setParsedData([])
      setError('')
      return
    }
    
    // 设置延迟解析（防抖）
    parseTimeoutRef.current = setTimeout(() => {
      handleParse()
    }, 500)
    
    // 清理函数
    return () => {
      if (parseTimeoutRef.current) {
        clearTimeout(parseTimeoutRef.current)
      }
    }
  }, [htmlInput])

  const formatDataForCopy = () => {
    if (parsedData.length === 0) return ''
    
    let result = ''
    parsedData.forEach((table, tableIdx) => {
      if (parsedData.length > 1) {
        result += `表格 ${table.tableIndex}:\n`
      }
      // 跳过第一行（表头），只复制数据行
      table.data.slice(1).forEach((row) => {
        result += row.join('\t') + '\n'
      })
      if (tableIdx < parsedData.length - 1) {
        result += '\n'
      }
    })
    return result
  }

  const handleCopy = async () => {
    const textToCopy = formatDataForCopy()
    if (!textToCopy) {
      setError('没有数据可复制')
      return
    }
    
    try {
      // 优先使用现代的 Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy)
        setCopied(true)
        setError('')
        setTimeout(() => setCopied(false), 2000)
      } else {
        // Fallback: 使用传统的 execCommand 方法
        const textArea = document.createElement('textarea')
        textArea.value = textToCopy
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        
        try {
          const successful = document.execCommand('copy')
          if (successful) {
            setCopied(true)
            setError('')
            setTimeout(() => setCopied(false), 2000)
          } else {
            throw new Error('execCommand 复制失败')
          }
        } finally {
          document.body.removeChild(textArea)
        }
      }
    } catch (err) {
      setError('复制失败，请手动复制')
      setCopied(false)
    }
  }

  const handleImport = async () => {
    if (parsedData.length === 0) {
      setError('没有数据可入库')
      return
    }
    
    setImporting(true)
    setError('')
    setImportResult(null)
    
    try {
      // 提取所有表格的数据行（跳过表头，只传数据）
      const allDataRows = []
      parsedData.forEach(table => {
        // 跳过第一行（表头），只取数据行
        table.data.slice(1).forEach(row => {
          // 检查代码列（索引1）是否包含"BJ"，如果包含则丢弃
          const codeValue = row[1] || ''
          if (typeof codeValue === 'string' && codeValue.includes('BJ')) {
            return // 跳过包含"BJ"的记录
          }
          allDataRows.push(row)
        })
      })
      
      if (allDataRows.length === 0) {
        setError('没有有效的数据行')
        setImporting(false)
        return
      }
      
      // 调用后端 API
      const response = await fetch(`${getApiBaseUrl()}/api/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: allDataRows }),
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || '入库失败')
      }
      
      setImportResult(result)
      setError('')
      
    } catch (err) {
      setError(`入库失败: ${err.message}`)
      setImportResult(null)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      <div className="space-y-6">
        {/* 输入区域 */}
        <div className="modern-card rounded-3xl p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white text-xl">📝</span>
            </div>
            <div>
              <label className="block text-lg font-bold text-gray-800">
                HTML代码输入
              </label>
              <p className="text-xs text-gray-500 mt-1">粘贴包含表格的HTML代码，系统将自动解析</p>
            </div>
          </div>
          <textarea
            value={htmlInput}
            onChange={(e) => setHtmlInput(e.target.value)}
            placeholder="粘贴HTML表格代码..."
            className="modern-input w-full h-40 font-mono text-sm resize-none shadow-inner"
          />
        </div>

        {/* 结果显示区域 */}
        <div className="modern-card rounded-3xl p-8 shadow-xl">
          <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-xl">📊</span>
              </div>
              <div>
                <label className="block text-lg font-bold text-gray-800">
                  解析结果
                </label>
                {parsedData.length > 0 && (
                  <span className="inline-flex items-center gap-1 mt-1 text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                    {parsedData.reduce((sum, table) => sum + Math.max(0, table.data.length - 1), 0)} 条数据
                  </span>
                )}
              </div>
            </div>
            {parsedData.length > 0 && (
              <div className="flex gap-3">
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-lg ${
                    importing
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : importResult
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-xl'
                      : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-xl hover:scale-105 active:scale-95'
                  }`}
                >
                  {importing
                    ? '⏳ 入库中...'
                    : importResult
                    ? `✓ 已入库 (${importResult.inserted}/${importResult.total})`
                    : '💾 入库'}
                </button>
                <button
                  onClick={handleCopy}
                  className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-lg ${
                    copied
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                      : 'tech-gradient text-white hover:shadow-xl hover:scale-105 active:scale-95'
                  }`}
                >
                  {copied ? '✓ 已复制' : '📋 复制'}
                </button>
              </div>
            )}
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-2xl p-6 overflow-auto border-2 border-gray-200">
            {error && (
              <div className="mb-6 p-4 bg-red-50 rounded-xl border-2 border-red-200 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 text-lg">⚠️</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-red-800 font-bold mb-1">解析错误</h4>
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                </div>
              </div>
            )}
            {parsedData.length > 0 ? (
              <div className="space-y-6">
                {parsedData.map((table, idx) => (
                  <div key={idx} className="animate-slide-up modern-card rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                      {parsedData.length > 1 && !table.isMerged && (
                        <h3 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                          <span className="text-2xl">📋</span>
                          表格 {table.tableIndex}
                        </h3>
                      )}
                      {table.isMerged && (
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">✨</span>
                          <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">股票结果</span>
                        </div>
                      )}
                    </div>
                    <div className="overflow-x-auto rounded-xl border-2 border-gray-200">
                      <table className="table-modern min-w-full">
                        <tbody>
                          {table.data.map((row, rowIdx) => (
                            <tr
                              key={rowIdx}
                              className={rowIdx === 0 ? 'bg-gradient-to-r from-blue-50 to-purple-50 font-bold' : rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                            >
                              {row.map((cell, cellIdx) => (
                                <td
                                  key={cellIdx}
                                  className={`px-4 py-3 text-sm max-w-[200px] ${
                                    table.isMerged && cellIdx === 0
                                      ? 'text-blue-600 font-bold bg-blue-50 border-r-2 border-blue-200'
                                      : rowIdx === 0
                                      ? 'text-gray-700 uppercase text-xs'
                                      : 'text-gray-700'
                                  }`}
                                  style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {cell || '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="flex flex-col items-center gap-4">
                  <div className="text-7xl animate-bounce">📋</div>
                  <h3 className="text-gray-600 text-xl font-bold">
                    {error ? '解析失败' : '解析结果将显示在这里'}
                  </h3>
                  <p className="text-gray-400 text-sm">在上方输入框中粘贴HTML代码并点击解析</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HtmlParser

