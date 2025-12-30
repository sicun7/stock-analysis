import { useState, useEffect, useMemo, useRef } from 'react'

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
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="modern-card rounded-3xl p-16 text-center max-w-md mx-auto">
          <div className="spinner w-16 h-16 mx-auto mb-6"></div>
          <p className="text-gray-600 text-lg font-medium">正在加载数据...</p>
          <p className="text-gray-400 text-sm mt-2">请稍候</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="modern-card rounded-3xl p-8 border-2 border-red-200 bg-red-50/50 max-w-md mx-auto">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="flex-1">
              <h3 className="text-red-800 font-bold text-lg mb-2">加载失败</h3>
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (headers.length === 0) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="modern-card rounded-3xl p-16 text-center max-w-md mx-auto">
          <div className="text-7xl mb-6 animate-bounce">📊</div>
          <h3 className="text-gray-700 text-xl font-bold mb-2">暂无数据</h3>
          <p className="text-gray-500">请先导入数据或检查数据库连接</p>
        </div>
      </div>
    )
  }

  const activeFiltersCount = Object.values(filters).filter(f => {
    if (!f) return false
    if (f.type === 'number') {
      return f.operator && f.operator !== '' && (f.value !== '' || f.min !== '' || f.max !== '')
    } else {
      return f.operator && f.value && f.value !== ''
    }
  }).length

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      {/* 筛选条件区域 */}
      <div className={`modern-card rounded-3xl shadow-xl ${
        filtersExpanded ? 'p-5 mb-6' : 'px-4 py-3 mb-4'
      }`}>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="flex items-center gap-3 text-sm font-bold text-gray-800 hover:text-blue-600 transition-all duration-200 touch-manipulation group"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
              filtersExpanded 
                ? 'bg-blue-500 text-white rotate-90' 
                : 'bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-600'
            }`}>
              <span className="text-sm">{filtersExpanded ? '▼' : '▶'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>筛选条件</span>
              {activeFiltersCount > 0 && (
                <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </div>
          </button>
          {activeFiltersCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl text-sm font-semibold transition-all duration-200 touch-manipulation shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
            >
              🗑️ 清除所有
            </button>
          )}
        </div>

        {filtersExpanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pt-4 border-t border-gray-200 filter-expand">
            {headers.map((header, index) => {
              const columnType = detectColumnType(header)
              const filter = filters[header] || {
                type: columnType,
                operator: columnType === 'number' ? 'range' : 'contains',
                value: '',
                min: '',
                max: ''
              }
              const isActive = filter.operator && (
                (filter.type === 'number' && (filter.value !== '' || filter.min !== '' || filter.max !== '')) ||
                (filter.type === 'text' && filter.value !== '')
              )

              return (
                <div key={index} className={`bg-gradient-to-br from-white to-gray-50 rounded-2xl p-4 border-2 transition-all duration-200 shadow-sm hover:shadow-md ${
                  isActive 
                    ? 'border-blue-400 bg-blue-50/50' 
                    : 'border-gray-200 hover:border-blue-300'
                }`}>
                  <label className="block text-xs font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></span>
                    {getDisplayHeaderName(header)}
                  </label>
                  {columnType === 'number' ? (
                    <div className="flex gap-2 items-center w-full">
                      <select
                        value={filter.operator || ''}
                        onChange={(e) => handleFilterChange(header, 'operator', e.target.value)}
                        className="modern-input bg-white border-2 border-gray-200 rounded-xl pl-3 pr-8 py-2 text-gray-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 whitespace-nowrap flex-shrink-0 touch-manipulation transition-all shadow-sm hover:shadow appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27%3E%3Cpath fill=%27none%27 stroke=%27%23343a40%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%272%27 d=%27M2 5l6 6 6-6%27/%3E%3C/svg%3E')] bg-no-repeat bg-right pr-2"
                        style={{ width: '80px', minHeight: '38px', backgroundPosition: 'right 0.5rem center' }}
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
                            className="modern-input flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-xs font-medium min-w-0 touch-manipulation"
                            style={{ minHeight: '38px' }}
                          />
                          <input
                            type="number"
                            step="any"
                            placeholder="最大"
                            value={filter.max || ''}
                            onChange={(e) => handleFilterChange(header, 'max', e.target.value)}
                            className="modern-input flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-xs font-medium min-w-0 touch-manipulation"
                            style={{ minHeight: '38px' }}
                          />
                        </>
                      ) : filter.operator && filter.operator !== '' ? (
                        <input
                          type="number"
                          step="any"
                          placeholder="数值"
                          value={filter.value || ''}
                          onChange={(e) => handleFilterChange(header, 'value', e.target.value)}
                          className="modern-input flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-xs font-medium min-w-0 touch-manipulation"
                          style={{ minHeight: '38px' }}
                        />
                      ) : (
                        <div className="flex-1"></div>
                      )}
            </div>
                  ) : (
                    <div className="flex gap-2 items-center w-full">
                      <select
                        value={filter.operator || 'contains'}
                        onChange={(e) => handleFilterChange(header, 'operator', e.target.value)}
                        className="modern-input bg-white border-2 border-gray-200 rounded-xl pl-3 pr-8 py-2 text-gray-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 whitespace-nowrap flex-shrink-0 touch-manipulation shadow-sm hover:shadow appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27%3E%3Cpath fill=%27none%27 stroke=%27%23343a40%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%272%27 d=%27M2 5l6 6 6-6%27/%3E%3C/svg%3E')] bg-no-repeat bg-right pr-2"
                        style={{ width: '80px', minHeight: '38px', backgroundPosition: 'right 0.5rem center' }}
                      >
                        <option value="contains">包含</option>
                        <option value="notContains">不包含</option>
                      </select>
                      <input
                        type="text"
                        placeholder="输入关键词"
                        value={filter.value || ''}
                        onChange={(e) => handleFilterChange(header, 'value', e.target.value)}
                        className="modern-input flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-xs font-medium min-w-0 touch-manipulation"
                        style={{ minHeight: '38px' }}
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
      <div className="modern-card rounded-3xl shadow-xl overflow-hidden">
        {/* 数据统计栏 */}
        <div className="px-3 sm:px-4 pt-2 sm:pt-3 pb-2 sm:pb-2.5 bg-gradient-to-r from-blue-50/50 via-purple-50/30 to-pink-50/30 border-b-2 border-gray-200">
          <div className="flex items-center justify-between gap-2 sm:gap-3 flex-nowrap overflow-x-auto">
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-xs sm:text-sm font-bold text-gray-700 whitespace-nowrap">数据统计</span>
              </div>
              <div className="text-xs sm:text-sm text-gray-700 font-semibold whitespace-nowrap">
                <span className="text-blue-600 text-sm sm:text-base font-bold">{filteredData.length}</span>
                <span className="text-gray-400 mx-1 sm:mx-2">/</span>
                <span className="text-gray-600">{excelData.length}</span>
                <span className="text-gray-500 ml-1 sm:ml-2">条</span>
              </div>
            </div>
            {filteredData.length !== excelData.length && (
              <div className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full border border-yellow-300 flex-shrink-0 whitespace-nowrap">
                🔍 已筛选 {filteredData.length} 条
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
          <table className="table-modern">
            <thead>
              <tr>
                {headers.map((header, index) => {
                  const isFixed = index < 2
                  const leftPosition = index === 0 ? 0 : (index === 1 ? firstColWidth : 0)
                  const isSorted = sortConfig.key === header
                  return (
                    <th
                      key={index}
                      ref={index === 0 ? firstColRef : null}
                      onClick={() => handleSort(header)}
                      className={`px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer transition-all duration-200 whitespace-nowrap touch-manipulation ${
                        isFixed ? 'md:sticky z-10 bg-gradient-to-r from-blue-50 to-purple-50' : ''
                      } ${isSorted ? 'text-blue-600 bg-blue-50' : 'hover:bg-blue-50/50'}`}
                      style={isFixed ? {
                        left: `${leftPosition}px`,
                        zIndex: index === 0 ? 10 : 11,
                        borderRight: index === 0 ? '2px solid #E5E7EB' : undefined
                      } : {}}
                    >
                      <div className="flex items-center gap-2">
                        <span>{getDisplayHeaderName(header)}</span>
                        <span className={`text-sm transition-transform ${isSorted ? 'scale-125' : ''}`}>
                          {getSortIcon(header)}
                        </span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="text-5xl">🔍</div>
                      <p className="text-gray-500 font-medium">没有匹配的数据</p>
                      <p className="text-gray-400 text-sm">请调整筛选条件</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={`transition-all duration-150 ${
                      highlightedRow === rowIndex
                        ? 'bg-gradient-to-r from-blue-50 to-purple-50 shadow-sm'
                        : 'hover:bg-blue-50/30'
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

                      // 为特定列添加颜色（使用内联样式确保优先级）
                      const getTextStyle = () => {
                        // T日列 - 深蓝色
                        if (header === 'T日') {
                          return { color: '#4338ca', fontWeight: '600' }
                        }
                        // 代码列 - 蓝色
                        if (isCodeColumn) {
                          return { color: '#2563eb', fontWeight: '500' }
                        }
                        // 股票列 - 紫色
                        if (isStockColumn) {
                          return { color: '#9333ea', fontWeight: '500' }
                        }
                        // T+1最大涨幅列 - 根据数值显示颜色：>=0红色，<0绿色
                        if (header === 'T加1最大涨幅') {
                          const numValue = Number(displayValue)
                          if (!isNaN(numValue)) {
                            return numValue >= 0 
                              ? { color: '#dc2626', fontWeight: '700' } 
                              : { color: '#16a34a', fontWeight: '700' }
                          }
                          return { color: '#dc2626', fontWeight: '700' } // 默认红色
                        }
                        // T量/T-1量列 - 橙色
                        if (header === 'T成交量除T减1成交量') {
                          return { color: '#ea580c', fontWeight: '600' }
                        }
                        // T换手率列 - 青色
                        if (header === 'T换手率') {
                          return { color: '#0891b2', fontWeight: '600' }
                        }
                        return {}
                      }

                      const textStyle = getTextStyle()
                      const fixedClass = isFixed ? 'md:sticky z-10' : ''
                      const clickClass = canClick ? 'cursor-pointer hover:underline active:underline touch-manipulation transition-all duration-150 group' : ''
                      
                      return (
                        <td
                          key={colIndex}
                          className={`px-4 py-3 text-sm whitespace-nowrap ${fixedClass} ${clickClass}`}
                          style={{
                            ...(isFixed ? {
                              left: `${leftPosition}px`,
                              backgroundColor: isHighlighted ? '#DBEAFE' : '#FFFFFF',
                              zIndex: colIndex === 0 ? 10 : 11,
                              borderRight: colIndex === 0 ? '2px solid #E5E7EB' : undefined
                            } : {}),
                            ...textStyle
                          }}
                          onClick={canClick ? (isCodeColumn ? () => openXueqiuPageFromCode(displayValue) : () => openXueqiuPage(displayValue)) : undefined}
                          title={canClick ? `点击查看 ${stockCode} 的雪球页面` : undefined}
                        >
                          <span className={canClick ? 'group-hover:font-bold transition-all' : ''}>
                            {displayValue}
                          </span>
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
