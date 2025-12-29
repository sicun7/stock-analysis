import { useState, useEffect, useMemo, useRef } from 'react'

// 获取API基础URL
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    // 如果是localhost或127.0.0.1，使用localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3001'
    }
    // 否则使用当前hostname（局域网IP）
    return `http://${hostname}:3001`
  }
  return 'http://localhost:3001'
}

function StockQuery() {
  const [excelData, setExcelData] = useState([])
  const [headers, setHeaders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({})
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const firstColRef = useRef(null)
  const [firstColWidth, setFirstColWidth] = useState(100)
  const [highlightedRow, setHighlightedRow] = useState(0)

  // 从数据库加载数据
  useEffect(() => {
    loadDataFromDatabase()
  }, [])

  const loadDataFromDatabase = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/query`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || '查询失败')
      }

      if (!result.data || result.data.length === 0) {
        setError('数据库中没有数据')
        setLoading(false)
      return
    }

      // 重新排序表头：将指定列提到"股票"列后面
      const reorderHeaders = (headers) => {
        // 需要提到"股票"列后面的列
        const priorityColumns = [
          'T加1最大涨幅',
          'T成交量除T减1成交量',
          'T换手率',
          'T涨幅',
          'T振幅'
        ]
        
        // 固定前几列的顺序
        const fixedColumns = ['T日', '代码', '股票']
        
        // 分离出固定列、优先列和其他列
        const fixed = []
        const priority = []
        const others = []
        
        headers.forEach(header => {
          if (fixedColumns.includes(header)) {
            fixed.push(header)
          } else if (priorityColumns.includes(header)) {
            priority.push(header)
          } else {
            others.push(header)
        }
        })
        
        // 按照优先级顺序排列优先列
        const orderedPriority = priorityColumns.filter(col => priority.includes(col))
        
        // 组合：固定列 + 优先列 + 其他列
        return [...fixed, ...orderedPriority, ...others]
      }
      
      const reorderedHeaders = reorderHeaders(result.headers)
      
      // 设置表头和数据
      setHeaders(reorderedHeaders)
      setExcelData(result.data)

      // 初始化筛选条件
      const initialFilters = {}
      reorderedHeaders.forEach(header => {
        const sampleValues = result.data
          .slice(0, 10)
          .map(row => row[header])
          .filter(val => val !== '' && val !== null && val !== undefined)

        let columnType = 'text'
        if (sampleValues.length > 0) {
          const numericCount = sampleValues.filter(val => isNumeric(val)).length
          columnType = numericCount / sampleValues.length > 0.5 ? 'number' : 'text'
        }

        initialFilters[header] = {
          type: columnType,
          operator: columnType === 'number' ? 'range' : 'contains',
          value: '',
          min: '',
          max: ''
        }
      })

      // 设置默认筛选条件
      if (initialFilters['T成交量除T减1成交量']) {
        initialFilters['T成交量除T减1成交量'] = {
          type: 'number',
          operator: 'greaterThan',
          value: '0.8',
          min: '',
          max: ''
        }
      }

      if (initialFilters['T换手率']) {
        initialFilters['T换手率'] = {
          type: 'number',
          operator: 'range',
          value: '',
          min: '5',
          max: '35'
        }
      }

      setFilters(initialFilters)

      // 设置默认排序：按日期（T日）降序排列
      setSortConfig({ key: 'T日', direction: 'desc' })

    } catch (err) {
      setError(`加载数据失败: ${err.message}`)
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  // 判断值是否为数字
  const isNumeric = (value) => {
    if (value === '' || value === null || value === undefined) return false
    const num = Number(value)
    return !isNaN(num) && isFinite(num)
  }


  // 格式化数字显示（保留两位小数）
  const formatNumber = (value) => {
    if (value === '' || value === null || value === undefined) return ''
    const num = Number(value)
    if (isNaN(num)) return String(value)
    if (Number.isInteger(num)) return String(num)
    return num.toFixed(2)
  }

  // 判断行是否为空
  const isRowEmpty = (row) => {
    return Object.values(row).every(val => val === '' || val === null || val === undefined)
  }

  // 检测列的数据类型
  const columnTypes = useMemo(() => {
    const types = {}
    headers.forEach(header => {
      const sampleValues = excelData
        .slice(0, 10)
        .map(row => row[header])
        .filter(val => val !== '' && val !== null && val !== undefined)

      if (sampleValues.length === 0) {
        types[header] = 'text'
      } else {
        const numericCount = sampleValues.filter(val => isNumeric(val)).length
        types[header] = numericCount / sampleValues.length > 0.5 ? 'number' : 'text'
      }
    })
    return types
  }, [headers, excelData])

  const detectColumnType = (columnName) => {
    return columnTypes[columnName] || 'text'
  }

  // 应用筛选
  const filteredData = useMemo(() => {
    let result = [...excelData]

    Object.keys(filters).forEach(columnName => {
      const filter = filters[columnName]

      if (!filter || !filter.operator) return

      if (filter.type === 'number') {
        result = result.filter(row => {
          const value = row[columnName]
          const numValue = Number(value)

          if (filter.operator === 'range' && filter.min === '' && filter.max === '') {
            return true
          }

          if (isNaN(numValue)) return false

          switch (filter.operator) {
            case 'equals':
              if (filter.value === '') return true
              return numValue === Number(filter.value)
            case 'notEquals':
              if (filter.value === '') return true
              return numValue !== Number(filter.value)
            case 'greaterThan':
              if (filter.value === '') return true
              return numValue > Number(filter.value)
            case 'greaterThanOrEqual':
              if (filter.value === '') return true
              return numValue >= Number(filter.value)
            case 'lessThan':
              if (filter.value === '') return true
              return numValue < Number(filter.value)
            case 'lessThanOrEqual':
              if (filter.value === '') return true
              return numValue <= Number(filter.value)
            case 'range':
              const minMatch = filter.min === '' || numValue >= Number(filter.min)
              const maxMatch = filter.max === '' || numValue <= Number(filter.max)
              return minMatch && maxMatch
            default:
              return true
          }
        })
      } else {
        const searchValue = filter.value?.toLowerCase() || ''
        if (searchValue) {
          result = result.filter(row => {
            const cellValue = String(row[columnName] || '').toLowerCase()
            if (filter.operator === 'notContains') {
              return !cellValue.includes(searchValue)
            } else {
              return cellValue.includes(searchValue)
            }
          })
        }
      }
    })

    // 应用排序
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key]
        const bVal = b[sortConfig.key]

        if (sortConfig.key === 'T日') {
          const aDate = new Date(aVal)
          const bDate = new Date(bVal)

          if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
            const comparison = aDate.getTime() - bDate.getTime()
            return sortConfig.direction === 'asc' ? comparison : -comparison
          }
        }

        const aNum = Number(aVal)
        const bNum = Number(bVal)

        let comparison = 0
        if (isNumeric(aVal) && isNumeric(bVal)) {
          comparison = aNum - bNum
        } else {
          comparison = String(aVal || '').localeCompare(String(bVal || ''))
        }

        return sortConfig.direction === 'asc' ? comparison : -comparison
      })
    }

    return result
  }, [excelData, filters, sortConfig])

  // 计算第一列宽度
  useEffect(() => {
    if (firstColRef.current) {
      const width = firstColRef.current.offsetWidth
      setFirstColWidth(width)
    }
  }, [filteredData, headers])

  // 处理筛选条件变化
  const handleFilterChange = (columnName, field, value) => {
    setFilters(prev => ({
      ...prev,
      [columnName]: {
        ...prev[columnName],
        [field]: value
      }
    }))
  }

  // 处理排序
  const handleSort = (columnName) => {
    setSortConfig(prev => {
      if (prev.key === columnName) {
        return {
          key: columnName,
          direction: prev.direction === 'asc' ? 'desc' : 'asc'
        }
      } else {
        return {
          key: columnName,
          direction: 'asc'
        }
      }
    })
  }

  // 清除所有筛选
  const clearAllFilters = () => {
    const clearedFilters = {}
    headers.forEach(header => {
      const columnType = detectColumnType(header)
      clearedFilters[header] = {
        type: columnType,
        operator: columnType === 'number' ? 'range' : 'contains',
        value: '',
        min: '',
        max: ''
      }
    })
    setFilters(clearedFilters)
    setSortConfig({ key: null, direction: 'asc' })
  }

  // 获取列显示名称（用于显示）
  const getDisplayHeaderName = (header) => {
    if (header === 'T成交量除T减1成交量') {
      return 'T量/T-1量'
    }
    if(header === 'T加1最大涨幅') {
      return 'T+1最大涨幅'
    }
    return header
  }

  // 获取排序图标
  const getSortIcon = (columnName) => {
    if (sortConfig.key !== columnName) {
      return '⇅'
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓'
  }

  // 从股票字符串中解析股票代码
  // 例如："5 金海高科603311.SH" -> "SH603311"
  const parseStockCode = (stockString) => {
    if (!stockString) return null

    // 匹配模式：数字 + . + 交易所代码（SH/SZ）
    // 例如：603311.SH 或 002056.SZ
    const match = stockString.match(/(\d{6})\.(SH|SZ)/i)
    if (match) {
      const code = match[1] // 6位数字
      const exchange = match[2].toUpperCase() // SH 或 SZ
      return `${exchange}${code}` // 返回 SH603311 或 SZ002056
    }
    return null
  }

  // 从代码列解析股票代码（格式如：688662.SH 或 920116.BJ）
  // 转换为雪球格式：SH688662 或 BJ920116
  const parseCodeColumn = (codeString) => {
    if (!codeString) return null
    
    // 匹配模式：数字 + . + 交易所代码（SH/SZ/BJ）
    const match = codeString.match(/(\d{6})\.(SH|SZ|BJ)/i)
    if (match) {
      const code = match[1] // 6位数字
      const exchange = match[2].toUpperCase() // SH、SZ 或 BJ
      return `${exchange}${code}` // 返回 SH688662、SZ002056 或 BJ920116
    }
    return null
  }

  // 打开雪球股票页面
  const openXueqiuPage = (stockString) => {
    const stockCode = parseStockCode(stockString)
    if (stockCode) {
      const url = `https://xueqiu.com/S/${stockCode}`
      window.open(url, '_blank')
    }
  }

  // 打开雪球股票页面（从代码列）
  const openXueqiuPageFromCode = (codeString) => {
    const stockCode = parseCodeColumn(codeString)
    if (stockCode) {
      const url = `https://xueqiu.com/S/${stockCode}`
      window.open(url, '_blank')
    }
  }

  if (loading) {
  return (
      <div className="w-full px-2 sm:px-3 md:px-4 lg:px-6 py-2 sm:py-3 md:py-4">
        <div className="modern-card rounded-2xl p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tech-blue"></div>
          <p className="text-gray-600 mt-4">正在加载数据...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full px-2 sm:px-3 md:px-4 lg:px-6 py-2 sm:py-3 md:py-4">
        <div className="modern-card rounded-2xl p-6 border-red-300">
          <div className="text-red-600 flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        </div>
            </div>
    )
  }

  if (headers.length === 0) {
    return (
      <div className="w-full px-2 sm:px-3 md:px-4 lg:px-6 py-2 sm:py-3 md:py-4">
        <div className="modern-card rounded-2xl p-12 text-center">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-gray-600">暂无数据</p>
              </div>
            </div>
    )
  }

  return (
    <div className="w-full px-2 sm:px-3 md:px-4 lg:px-6 py-2 sm:py-3 md:py-4">
      {/* 筛选条件区域 */}
      <div className="modern-card rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-semibold text-gray-800 active:text-tech-blue transition-colors touch-manipulation"
          >
            <span className="text-sm sm:text-base">{filtersExpanded ? '▼' : '▶'}</span>
            <span>筛选条件</span>
            <span className="hidden sm:inline text-xs text-gray-500 font-normal">
              ({Object.values(filters).filter(f => {
                if (!f) return false
                if (f.type === 'number') {
                  return f.operator && f.operator !== '' && (f.value !== '' || f.min !== '' || f.max !== '')
                } else {
                  return f.operator && f.value && f.value !== ''
                }
              }).length} 个已设置)
            </span>
          </button>
          <button
            onClick={clearAllFilters}
            className="px-3 sm:px-4 py-1.5 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 rounded-lg text-xs font-medium transition-all duration-200 touch-manipulation shadow-sm"
          >
            清除所有
          </button>
          </div>

        {filtersExpanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {headers.map((header, index) => {
              const columnType = detectColumnType(header)
              const filter = filters[header] || {
                type: columnType,
                operator: columnType === 'number' ? 'range' : 'contains',
                value: '',
                min: '',
                max: ''
              }

              return (
                <div key={index} className="bg-white rounded-xl p-3 border border-gray-200 hover:border-tech-blue/30 transition-all shadow-sm">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    {getDisplayHeaderName(header)}
                  </label>
                  {columnType === 'number' ? (
                    <div className="flex gap-1 items-center w-full">
                      <select
                        value={filter.operator || ''}
                        onChange={(e) => handleFilterChange(header, 'operator', e.target.value)}
                        className="bg-white border border-gray-300 rounded-lg px-2 py-2 sm:py-1 text-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-tech-blue/30 focus:border-tech-blue whitespace-nowrap flex-shrink-0 touch-manipulation transition-all"
                        style={{ width: '70px', minHeight: '36px' }}
                      >
                        <option value="">请选择</option>
                        <option value="equals">等于</option>
                        <option value="notEquals">不等于</option>
                        <option value="greaterThan">大于</option>
                        <option value="greaterThanOrEqual">大于等于</option>
                        <option value="lessThan">小于</option>
                        <option value="lessThanOrEqual">小于等于</option>
                        <option value="range">区间</option>
                      </select>
                      {filter.operator === 'range' ? (
                        <>
                          <input
                            type="number"
                            step="any"
                            placeholder="最小"
                            value={filter.min || ''}
                            onChange={(e) => handleFilterChange(header, 'min', e.target.value)}
                            className="flex-1 bg-white border border-gray-300 rounded-lg px-2 py-2 sm:py-1 text-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-tech-blue/30 focus:border-tech-blue min-w-0 touch-manipulation transition-all"
                            style={{ minHeight: '36px' }}
                          />
                          <input
                            type="number"
                            step="any"
                            placeholder="最大"
                            value={filter.max || ''}
                            onChange={(e) => handleFilterChange(header, 'max', e.target.value)}
                            className="flex-1 bg-white border border-gray-300 rounded-lg px-2 py-2 sm:py-1 text-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-tech-blue/30 focus:border-tech-blue min-w-0 touch-manipulation transition-all"
                            style={{ minHeight: '36px' }}
                          />
                        </>
                      ) : filter.operator && filter.operator !== '' ? (
                        <input
                          type="number"
                          step="any"
                          placeholder="数值"
                          value={filter.value || ''}
                          onChange={(e) => handleFilterChange(header, 'value', e.target.value)}
                          className="flex-1 bg-white border border-gray-300 rounded-lg px-2 py-2 sm:py-1 text-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-tech-blue/30 focus:border-tech-blue min-w-0 touch-manipulation transition-all"
                          style={{ minHeight: '36px' }}
                        />
                      ) : (
                        <div className="flex-1"></div>
                      )}
            </div>
                  ) : (
                    <div className="flex gap-1 items-center w-full">
                      <select
                        value={filter.operator || 'contains'}
                        onChange={(e) => handleFilterChange(header, 'operator', e.target.value)}
                        className="bg-white border border-gray-300 rounded-lg px-2 py-2 sm:py-1 text-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-tech-blue/30 focus:border-tech-blue whitespace-nowrap flex-shrink-0 touch-manipulation transition-all"
                        style={{ width: '70px', minHeight: '36px' }}
                      >
                        <option value="contains">包含</option>
                        <option value="notContains">不包含</option>
                      </select>
                      <input
                        type="text"
                        placeholder="输入关键词"
                        value={filter.value || ''}
                        onChange={(e) => handleFilterChange(header, 'value', e.target.value)}
                        className="flex-1 bg-white border border-gray-300 rounded-lg px-2 py-2 sm:py-1 text-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-tech-blue/30 focus:border-tech-blue min-w-0 touch-manipulation transition-all"
                        style={{ minHeight: '36px' }}
                      />
            </div>
                  )}
            </div>
              )
            })}
            </div>
        )}
          </div>

      {/* 数据表格 */}
      <div className="modern-card rounded-2xl">
        {/* 数据统计栏 */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-gray-200">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs sm:text-sm text-gray-700">
              <span className="text-tech-blue font-semibold">{filteredData.length}</span>
              <span className="text-gray-500"> / </span>
              <span className="text-gray-500">{excelData.length}</span>
              <span className="text-gray-500 ml-1">条数据</span>
            </div>
            {filteredData.length !== excelData.length && (
              <div className="text-xs text-gray-600">
                已筛选，显示 {filteredData.length} 条
              </div>
            )}
          </div>
        </div>

        {/* 表格容器 */}
        <div
          className="overflow-x-auto"
          onMouseLeave={() => {
            // 鼠标离开表格时，保持当前高亮，不做任何操作
          }}
        >
          <table className="w-full min-w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {headers.map((header, index) => {
                  const isFixed = index < 2
                  const leftPosition = index === 0 ? 0 : (index === 1 ? firstColWidth : 0)
                  return (
                    <th
                      key={index}
                      ref={index === 0 ? firstColRef : null}
                      onClick={() => handleSort(header)}
                      className={`px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-tech-blue cursor-pointer hover:bg-gray-100 active:bg-gray-200 transition-colors whitespace-nowrap touch-manipulation ${isFixed ? 'md:sticky z-10' : ''
                        }`}
                      style={isFixed ? {
                        left: `${leftPosition}px`,
                        backgroundColor: '#F8FAFC',
                        zIndex: index === 0 ? 10 : 11,
                        borderRight: index === 0 ? 'none' : undefined
                      } : {
                        backgroundColor: '#F8FAFC'
                      }}
                    >
                      <div className="flex items-center gap-1 sm:gap-2">
                        <span>{getDisplayHeaderName(header)}</span>
                        <span className="text-xs">{getSortIcon(header)}</span>
        </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} className="px-4 py-8 text-center text-gray-500">
                    没有匹配的数据
                  </td>
                </tr>
              ) : (
                filteredData.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={`border-b border-gray-100 transition-colors ${highlightedRow === rowIndex
                      ? 'bg-blue-50 hover:bg-blue-100'
                      : 'hover:bg-gray-50'
                      }`}
                    onMouseEnter={() => setHighlightedRow(rowIndex)}
                  >
                    {headers.map((header, colIndex) => {
                      const isFixed = colIndex < 2
                      const leftPosition = colIndex === 0 ? 0 : (colIndex === 1 ? firstColWidth : 0)
                      let displayValue = row[header]
                      if (displayValue === null || displayValue === undefined) {
                        displayValue = ''
                      } else {
                        if (isNumeric(displayValue)) {
                          displayValue = formatNumber(displayValue)
                        } else {
                          displayValue = String(displayValue)
                        }
                      }

                      const isStockColumn = header === '股票'
                      const isCodeColumn = header === '代码'
                      const stockCode = isStockColumn ? parseStockCode(displayValue) : (isCodeColumn ? parseCodeColumn(displayValue) : null)
                      const canClick = (isStockColumn && stockCode !== null) || (isCodeColumn && stockCode !== null)

                      // 判断当前行是否高亮
                      const isHighlighted = highlightedRow === rowIndex

                      // 为代码和股票列添加颜色
                      const getTextColor = () => {
                        if (isCodeColumn) {
                          return 'text-blue-600 font-medium'
                        }
                        if (isStockColumn) {
                          return 'text-purple-600 font-medium'
                        }
                        if (header === 'T加1最大涨幅') {
                          // 根据数值显示颜色：0或正数显示红色，负数显示绿色
                          const numValue = Number(displayValue)
                          if (!isNaN(numValue)) {
                            return numValue >= 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'
                          }
                          return 'text-red-600 font-medium' // 默认红色
                        }
                        return 'text-gray-700'
                      }

                      return (
                        <td
                          key={colIndex}
                          className={`px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm whitespace-nowrap ${getTextColor()} ${isFixed ? 'md:sticky z-10' : ''
                            } ${canClick ? 'cursor-pointer hover:text-tech-blue hover:underline active:text-tech-blue active:underline touch-manipulation transition-colors' : ''}`}
                          style={isFixed ? {
                            left: `${leftPosition}px`,
                            backgroundColor: isHighlighted ? '#DBEAFE' : '#FFFFFF', // 高亮时使用蓝色背景
                            zIndex: colIndex === 0 ? 10 : 11,
                            borderRight: colIndex === 0 ? 'none' : undefined
                          } : {}}
                          onClick={canClick ? (isCodeColumn ? () => openXueqiuPageFromCode(displayValue) : () => openXueqiuPage(displayValue)) : undefined}
                          title={canClick ? `点击查看 ${stockCode} 的雪球页面` : undefined}
                        >
                          {displayValue}
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default StockQuery
