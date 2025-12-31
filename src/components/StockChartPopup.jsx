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

function StockChartPopup({ stockCode, isVisible, onClose, position, onMouseEnter, onMouseLeave }) {
  const [chartType, setChartType] = useState("day"); // day, minute
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const currentCodeRef = useRef("");
  const currentTypeRef = useRef("day");
  const lastPeriodRef = useRef("");
  const lastCodeRef = useRef("");
  const lastTypeRef = useRef("");
  const popupRef = useRef(null);

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

  // 初始化图表（当弹窗可见且容器存在时）
  useEffect(() => {
    if (isVisible && chartContainerRef.current && !chartRef.current) {
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

      // 设置数据加载器
      chartRef.current.setDataLoader({
        getBars: async ({ callback }) => {
          const code = currentCodeRef.current;
          const type = currentTypeRef.current;

          if (!code) {
            callback([]);
            return;
          }

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
  }, [isVisible]);

  // 当弹窗关闭时，清空所有 ref，避免下次打开时检查失败
  useEffect(() => {
    if (!isVisible) {
      lastCodeRef.current = "";
      lastPeriodRef.current = "";
      lastTypeRef.current = "";
      currentCodeRef.current = "";
      currentTypeRef.current = "day";
    }
  }, [isVisible]);

  // 获取K线数据
  const fetchKLineData = async (code, type) => {
    // 如果图表还没初始化，等待一下
    if (!chartRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (!chartRef.current) {
        setError("图表初始化中，请稍候...");
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      const formattedCode = formatStockCode(code);
      if (!formattedCode) {
        throw new Error("股票代码格式不正确");
      }

      // 更新当前代码和类型（必须在调用 setSymbol 之前更新）
      currentCodeRef.current = code;
      currentTypeRef.current = type;

      if (chartRef.current) {
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
        }

        const displayCode = formattedCode.toUpperCase();

        const periodKey = `${periodType}_${span}`;
        const codeKey = displayCode;

        const needUpdatePeriod = lastPeriodRef.current !== periodKey;
        const needUpdateSymbol = lastCodeRef.current !== codeKey;
        const needUpdateType = lastTypeRef.current !== type;

        if (needUpdateType || needUpdatePeriod || needUpdateSymbol) {
          if (needUpdatePeriod && needUpdateSymbol) {
            // 两者都需要更新：先更新period（触发getBars但会被忽略），然后更新symbol（触发getBars并处理）
            chartRef.current.setPeriod({ span, type: periodType });
            lastPeriodRef.current = periodKey;
            // 切换股票时，先清空 lastCodeRef，这样 getBars 中的检查才能通过
            lastCodeRef.current = "";
            chartRef.current.setSymbol({ ticker: displayCode });
            // 延迟更新 lastCodeRef，确保 getBars 已经处理完
            setTimeout(() => {
              lastCodeRef.current = codeKey;
              lastTypeRef.current = type;
            }, 100);
          } else if (needUpdatePeriod) {
            // 只有period需要更新
            chartRef.current.setPeriod({ span, type: periodType });
            lastPeriodRef.current = periodKey;
            lastTypeRef.current = type;
          } else if (needUpdateSymbol) {
            // 只有symbol需要更新：切换股票时，先清空 lastCodeRef
            lastCodeRef.current = "";
            chartRef.current.setSymbol({ ticker: displayCode });
            // 延迟更新 lastCodeRef，确保 getBars 已经处理完
            setTimeout(() => {
              lastCodeRef.current = codeKey;
              lastTypeRef.current = type;
            }, 100);
          } else if (needUpdateType) {
            // 只有type需要更新，调用setSymbol触发数据加载
            chartRef.current.setSymbol({ ticker: displayCode });
            lastTypeRef.current = type;
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (err) {
      setError(err.message || "获取数据失败");
      currentCodeRef.current = "";
    } finally {
      setLoading(false);
    }
  };

  // 当股票代码或可见性变化时，加载数据
  useEffect(() => {
    if (isVisible && stockCode && chartRef.current) {
      const formattedCode = formatStockCode(stockCode);
      if (formattedCode) {
        const displayCode = formattedCode.toUpperCase();
        // 如果股票代码变化了，先清空 lastCodeRef，确保能正常加载
        if (lastCodeRef.current && lastCodeRef.current !== displayCode) {
          lastCodeRef.current = "";
        }
        // 延迟一下，确保图表完全初始化
        const timer = setTimeout(() => {
          fetchKLineData(stockCode, chartType);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [isVisible, stockCode, chartType]);

  // 切换图表类型
  const handleTypeChange = (type) => {
    setChartType(type);
    if (stockCode) {
      fetchKLineData(stockCode, type);
    }
  };

  // 点击外部关闭弹窗（只在点击时关闭，不影响鼠标悬浮）
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isVisible) {
      // 使用 click 事件而不是 mousedown，避免与悬浮逻辑冲突
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isVisible, onClose]);

  // 计算弹窗位置
  const popupStyle = position
    ? {
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
      }
    : {};

  if (!isVisible) return null;

  return (
    <div
      ref={popupRef}
      className="fixed bg-white rounded-2xl shadow-2xl border-2 border-gray-200 overflow-hidden"
      style={{
        ...popupStyle,
        width: "500px",
        height: "336px", // header(36px) + 走势图(300px)
        maxWidth: "90vw",
        maxHeight: "80vh",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between p-2 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200" style={{ height: "36px", minHeight: "36px" }}>
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-gray-800">
            {stockCode ? `股票走势 - ${stockCode}` : "股票走势"}
          </h3>
          {loading && (
            <span className="text-xs text-gray-500 animate-pulse">加载中...</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* 图表类型切换 */}
          <div className="flex gap-1">
            {[
              { key: "minute", label: "分时" },
              { key: "day", label: "日K" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleTypeChange(key)}
                className={`px-1.5 py-0.5 rounded text-xs transition-colors font-medium ${
                  chartType === key
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors text-sm"
            title="关闭"
          >
            ×
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="p-1.5 bg-red-50 border-b border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* 图表容器 */}
      <div
        ref={chartContainerRef}
        className="w-full"
        style={{ height: "300px" }}
      />
    </div>
  );
}

export default StockChartPopup;

