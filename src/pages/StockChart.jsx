import { useState, useEffect, useRef } from "react";
import { init, dispose } from "klinecharts";

// 获取API基础URL
const getApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:8887";
    }
    return `http://${hostname}:8887`;
  }
  return "http://localhost:8887";
};

function StockChart() {
  const [stockCode, setStockCode] = useState("");
  const [chartType, setChartType] = useState("day"); // day, minute, week, month
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const currentCodeRef = useRef("");
  const currentTypeRef = useRef("day");
  const lastPeriodRef = useRef(""); // 记录上次设置的周期
  const lastCodeRef = useRef(""); // 记录上次设置的代码
  const lastTypeRef = useRef(""); // 记录上次设置的type（week/month/day/minute）

  // 格式化股票代码（支持多种格式）
  const formatStockCode = (code) => {
    if (!code) return null;

    // 移除空格
    code = code.trim().replace(/\s/g, "");

    // 如果已经是完整格式（如 sh600000, sz000001），直接返回（小写用于API）
    if (/^(sh|sz|bj)\d{6}$/i.test(code)) {
      return code.toLowerCase();
    }

    // 如果是 6 位数字，默认使用 sh（上海）
    if (/^\d{6}$/.test(code)) {
      // 根据代码判断交易所
      const num = parseInt(code);
      if (code.startsWith("6") || code.startsWith("9")) {
        return `sh${code}`;
      } else if (code.startsWith("0") || code.startsWith("3")) {
        return `sz${code}`;
      } else if (code.startsWith("8") || code.startsWith("4")) {
        return `bj${code}`;
      }
      return `sh${code}`; // 默认上海
    }

    // 如果包含点号（如 600000.SH），转换为 sh600000
    const match = code.match(/(\d{6})\.(SH|SZ|BJ)/i);
    if (match) {
      const exchange = match[2].toLowerCase();
      return `${exchange}${match[1]}`;
    }

    return null;
  };

  // 初始化图表
  useEffect(() => {
    if (chartContainerRef.current && !chartRef.current) {
      chartRef.current = init(chartContainerRef.current, {
        locale: "zh-CN",
        thousandsSeparator: { sign: "" },
        layout: [
          {
            type: "candle",
            options: { order: Number.MIN_SAFE_INTEGER },
            content: [{ name: "MA", calcParams: [5, 10, 20] }],
          },
          { type: "indicator", content: ["VOL"], options: { order: 10 } },
          { type: "xAxis", options: { order: 9 } },
        ],
        styles: {
          candle: {
            type: "candle_solid",
            bar: {
              compareRule: "current_open",
              upColor: "#F92855",
              downColor: "#2DC08E",
              noChangeColor: "#888888",
              upBorderColor: "#F92855",
              downBorderColor: "#2DC08E",
              noChangeBorderColor: "#888888",
              upWickColor: "#F92855",
              downWickColor: "#2DC08E",
              noChangeWickColor: "#888888",
            },
          },
          indicator: {
            bars: [
              {
                style: "fill",
                borderStyle: "solid",
                borderSize: 1,
                borderDashedValue: [2, 2],
                upColor: "#F92855",
                downColor: "#2DC08E",
                noChangeColor: "#888888",
              },
            ],
          },
        },
      });

      // 设置数据加载器（klinecharts 10.0.0 新API）
      chartRef.current.setDataLoader({
        getBars: async ({ callback }) => {
          const code = currentCodeRef.current;
          const type = currentTypeRef.current;

          if (!code) {
            callback([]);
            return;
          }

          // 检查当前请求的参数是否与最新的参数匹配
          // 如果不匹配，说明这是旧的请求（比如setPeriod触发的），应该忽略
          const formattedCode = formatStockCode(code);
          if (!formattedCode) {
            callback([]);
            return;
          }
          
          const displayCode = formattedCode.toUpperCase();
          
          // 关键检查：如果lastCodeRef已设置且与当前代码不匹配，说明这是setPeriod触发的请求
          // 应该忽略，因为setPeriod会触发getBars，但此时symbol还没更新
          // 只有当lastCodeRef与当前代码匹配时，才说明这是setSymbol触发的请求，应该处理
          if (lastCodeRef.current) {
            if (lastCodeRef.current !== displayCode) {
              // lastCodeRef已设置但代码不匹配，这是setPeriod触发的请求，忽略
              callback([]);
              return;
            }
            // lastCodeRef已设置且代码匹配，这是setSymbol触发的请求，继续处理
          }
          // 如果lastCodeRef还没设置（首次调用），继续处理

          try {
            const response = await fetch(
              `${getApiBaseUrl()}/api/kline?code=${formattedCode}&type=${type}`
            );

            if (!response.ok) {
              callback([]);
              return;
            }

            const result = await response.json();

            if (!result.success || !result.data || result.data.length === 0) {
              callback([]);
              return;
            }

            // 转换数据格式为 KLineChart 需要的格式
            const klineData = result.data.map((item) => ({
              timestamp: item.timestamp || item.time || item.date,
              open: parseFloat(item.open),
              high: parseFloat(item.high),
              low: parseFloat(item.low),
              close: parseFloat(item.close),
              volume: parseFloat(item.volume || item.vol || 0),
            }));

            callback(klineData);
          } catch (err) {
            callback([]);
          }
        },
      });
    }

    return () => {
      if (chartRef.current) {
        dispose(chartRef.current);
        chartRef.current = null;
      }
    };
  }, []);

  // 获取K线数据（使用新API的setSymbol和setPeriod方法）
  const fetchKLineData = async (code, type) => {
    setLoading(true);
    setError("");

    try {
      const formattedCode = formatStockCode(code);
      if (!formattedCode) {
        throw new Error("股票代码格式不正确，请输入6位数字代码（如：600000）");
      }

      // 更新当前代码和类型
      currentCodeRef.current = code;
      currentTypeRef.current = type;

      // 设置股票代码和周期，这会自动触发 getBars 加载数据
      if (chartRef.current) {
        // 转换周期类型
        let periodType = "day";
        let span = 1;

        switch (type) {
          case "minute":
            periodType = "minute";
            span = 5;
            break;
          case "day":
            periodType = "day";
            span = 1;
            break;
          case "week":
            // 周K和月K使用day类型，因为数据已经聚合好了
            periodType = "day";
            span = 1;
            break;
          case "month":
            periodType = "day";
            span = 1;
            break;
        }

        // 将代码转换为大写显示（如 SZ000050）
        const displayCode = formattedCode.toUpperCase();
        
        // 构建周期标识和代码标识
        const periodKey = `${periodType}_${span}`;
        const codeKey = displayCode;
        
        // 判断是否需要更新period、symbol和type
        const needUpdatePeriod = lastPeriodRef.current !== periodKey;
        const needUpdateSymbol = lastCodeRef.current !== codeKey;
        const needUpdateType = lastTypeRef.current !== type;
        
        // 关键逻辑：如果type变化了，即使period和symbol没变，也需要触发更新
        // 因为周K、月K虽然periodType都是"day"，但实际需要的数据不同
        if (needUpdateType || needUpdatePeriod || needUpdateSymbol) {
          if (needUpdatePeriod && needUpdateSymbol) {
            // 两者都需要更新：先更新period（触发getBars但会被忽略），然后更新symbol（触发getBars并处理）
            chartRef.current.setPeriod({ span, type: periodType });
            lastPeriodRef.current = periodKey;
            chartRef.current.setSymbol({ ticker: displayCode });
            lastCodeRef.current = codeKey;
            lastTypeRef.current = type;
          } else if (needUpdatePeriod) {
            // 只有period需要更新
            chartRef.current.setPeriod({ span, type: periodType });
            lastPeriodRef.current = periodKey;
            lastTypeRef.current = type;
          } else if (needUpdateSymbol) {
            // 只有symbol需要更新
            chartRef.current.setSymbol({ ticker: displayCode });
            lastCodeRef.current = codeKey;
            lastTypeRef.current = type;
          } else if (needUpdateType) {
            // 只有type需要更新（比如从日K切换到周K，period和symbol都没变，但type变了）
            // 需要触发数据加载，调用setSymbol即可
            chartRef.current.setSymbol({ ticker: displayCode });
            lastTypeRef.current = type;
          }
        }
        // 如果都不需要更新，说明参数没变化，不需要调用任何方法
      }

      // 等待一下，让 getBars 完成数据加载
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (err) {
      setError(err.message || "获取数据失败");
      // 清空当前代码
      currentCodeRef.current = "";
    } finally {
      setLoading(false);
    }
  };

  // 处理查询
  const handleQuery = () => {
    if (!stockCode.trim()) {
      setError("请输入股票代码");
      return;
    }
    fetchKLineData(stockCode, chartType);
  };

  // 切换图表类型
  const handleTypeChange = (type) => {
    setChartType(type);
    if (stockCode.trim()) {
      fetchKLineData(stockCode, type);
    }
  };

  // 回车查询
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleQuery();
    }
  };

  return (
    <div className="w-full h-[calc(100vh-60px)] flex flex-col px-4 sm:px-6 lg:px-8 py-4">
      <div className="max-w-7xl mx-auto w-full flex flex-col flex-1 min-h-0">
        <div className="modern-card rounded-2xl p-3 sm:p-4 shadow-lg mb-3 flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3">
            股票走势
          </h2>

          {/* 输入框和查询按钮 */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <div className="flex-1">
              <input
                type="text"
                value={stockCode}
                onChange={(e) => setStockCode(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="请输入股票代码（如：600000）"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleQuery}
              disabled={loading}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold whitespace-nowrap"
            >
              {loading ? "查询中..." : "查询"}
            </button>
          </div>

          {/* 图表类型切换 */}
          <div className="flex flex-wrap gap-2 mb-2">
            {[
              { key: "minute", label: "分时" },
              { key: "day", label: "日K" },
              // 周K和月K暂时隐藏，因为数据源不支持
              // { key: "week", label: "周K" },
              // { key: "month", label: "月K" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleTypeChange(key)}
                className={`px-3 py-1 rounded-lg transition-colors font-medium text-xs ${
                  chartType === key
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
              {error}
            </div>
          )}
        </div>

        {/* 图表容器 */}
        <div className="modern-card rounded-2xl p-3 sm:p-4 shadow-lg flex-1 min-h-0 flex flex-col">
          <div
            ref={chartContainerRef}
            className="w-full flex-1"
            style={{ minHeight: 0 }}
          />
        </div>
      </div>
    </div>
  );
}

export default StockChart;
