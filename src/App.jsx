import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import HtmlParser from './pages/HtmlParser'
import StockQuery from './pages/StockQuery'

function Navigation() {
  const location = useLocation()
  
  return (
    <nav className="modern-card border-b border-tech-blue/10 mb-2 sm:mb-3 md:mb-4 rounded-none">
      <div className="w-full px-2 sm:px-3 md:px-4 lg:px-6">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 tech-gradient rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
              <span className="text-white font-bold text-sm sm:text-base md:text-lg">📊</span>
            </div>
            <h1 className="text-sm sm:text-base md:text-xl font-bold bg-gradient-to-r from-tech-blue via-tech-purple to-tech-blue bg-clip-text text-transparent whitespace-nowrap bg-[length:200%_auto] animate-gradient">
              <span className="hidden sm:inline">掘金分析</span>
              <span className="sm:hidden">掘金分析</span>
            </h1>
          </div>
          <div className="flex space-x-1.5 sm:space-x-2">
            <Link
              to="/"
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md transition-all duration-300 text-xs sm:text-sm font-medium touch-manipulation ${
                location.pathname === '/'
                  ? 'tech-gradient text-white shadow-md'
                  : 'text-gray-600 hover:text-tech-blue hover:bg-blue-50 active:bg-blue-100 border border-transparent hover:border-blue-200'
              }`}
            >
              <span className="hidden sm:inline">数据分析</span>
              <span className="sm:hidden">数据分析</span>
            </Link>
            <Link
              to="/parse"
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md transition-all duration-300 text-xs sm:text-sm font-medium touch-manipulation ${
                location.pathname === '/parse'
                  ? 'tech-gradient text-white shadow-md'
                  : 'text-gray-600 hover:text-tech-blue hover:bg-blue-50 active:bg-blue-100 border border-transparent hover:border-blue-200'
              }`}
            >
              <span className="hidden sm:inline">数据解析</span>
              <span className="sm:hidden">数据解析</span>
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
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <Routes>
          <Route path="/" element={<StockQuery />} />
          <Route path="/parse" element={<HtmlParser />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
