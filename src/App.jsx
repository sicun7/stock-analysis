import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import HtmlParser from './pages/HtmlParser'
import StockQuery from './pages/StockQuery'
import StockChart from './pages/StockChart'

function Navigation() {
  const location = useLocation()
  
  return (
    <nav className="sticky top-0 z-50 glass border-b border-white/20 backdrop-blur-xl">
      <div className="w-full px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[60px]">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 tech-gradient rounded-xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-300">
                <span className="text-white font-bold text-sm sm:text-lg">📊</span>
              </div>
              <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg md:text-xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent whitespace-nowrap truncate">
                掘金分析
              </h1>
              <p className="text-xs text-gray-500 hidden sm:block truncate">智能股票数据分析平台</p>
            </div>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            <Link
              to="/"
              className={`relative px-2.5 sm:px-4 rounded-lg transition-all duration-300 text-xs sm:text-sm font-semibold touch-manipulation whitespace-nowrap ${
                location.pathname === '/'
                  ? 'tech-gradient text-white shadow-lg py-1 sm:py-1.5'
                  : 'text-gray-700 hover:text-blue-600 hover:bg-white/60 active:scale-95 py-1.5 sm:py-2'
              }`}
            >
              <span className="relative z-10 flex items-center gap-1 sm:gap-2">
                <span className="text-base sm:text-lg">📊</span>
                <span className="hidden sm:inline">数据分析</span>
              </span>
              {location.pathname === '/' && (
                <div className="absolute inset-0 bg-white/20 rounded-lg animate-pulse"></div>
              )}
            </Link>
            <Link
              to="/parse"
              className={`relative px-2.5 sm:px-4 rounded-lg transition-all duration-300 text-xs sm:text-sm font-semibold touch-manipulation whitespace-nowrap ${
                location.pathname === '/parse'
                  ? 'tech-gradient text-white shadow-lg py-1 sm:py-1.5'
                  : 'text-gray-700 hover:text-purple-600 hover:bg-white/60 active:scale-95 py-1.5 sm:py-2'
              }`}
            >
              <span className="relative z-10 flex items-center gap-1 sm:gap-2">
                <span className="text-base sm:text-lg">🛠️</span>
                <span className="hidden sm:inline">数据解析</span>
              </span>
              {location.pathname === '/parse' && (
                <div className="absolute inset-0 bg-white/20 rounded-lg animate-pulse"></div>
              )}
            </Link>
            <Link
              to="/chart"
              className={`relative px-2.5 sm:px-4 rounded-lg transition-all duration-300 text-xs sm:text-sm font-semibold touch-manipulation whitespace-nowrap ${
                location.pathname === '/chart'
                  ? 'tech-gradient text-white shadow-lg py-1 sm:py-1.5'
                  : 'text-gray-700 hover:text-green-600 hover:bg-white/60 active:scale-95 py-1.5 sm:py-2'
              }`}
            >
              <span className="relative z-10 flex items-center gap-1 sm:gap-2">
                <span className="text-base sm:text-lg">📈</span>
                <span className="hidden sm:inline">股票走势</span>
              </span>
              {location.pathname === '/chart' && (
                <div className="absolute inset-0 bg-white/20 rounded-lg animate-pulse"></div>
              )}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}

function App() {
  return (
    <Router>
      <div className="min-h-screen">
        <Navigation />
        <main className="pb-8">
          <Routes>
            <Route path="/" element={<StockQuery />} />
            <Route path="/parse" element={<HtmlParser />} />
            <Route path="/chart" element={<StockChart />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
