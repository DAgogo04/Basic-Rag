import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import {
  ArrowUpTrayIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'
import UploadPage from './pages/UploadPage'
import DocumentListPage from './pages/DocumentListPage'
import ChatPage from './pages/ChatPage'
import SettingsPage from './pages/SettingsPage'

const navItems = [
  { to: '/', label: '上传文档', icon: ArrowUpTrayIcon },
  { to: '/documents', label: '文档列表', icon: DocumentTextIcon },
  { to: '/chat', label: '知识问答', icon: ChatBubbleLeftRightIcon },
  { to: '/settings', label: 'API 配置', icon: Cog6ToothIcon },
]

function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-gray-50">
        <nav className="w-60 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
          <div className="px-6 py-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900 font-[Poppins] tracking-wide">
              RAG 知识库
            </h1>
            <p className="text-xs text-gray-500 mt-1">智能文档问答系统</p>
          </div>
          <div className="flex flex-col gap-1 p-3 mt-2">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 font-semibold'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                {label}
              </NavLink>
            ))}
          </div>
          <div className="mt-auto px-6 py-4 border-t border-gray-200">
            <p className="text-xs text-gray-400">Powered by RAG</p>
          </div>
        </nav>
        <main className="flex-1 overflow-auto p-6">
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/documents" element={<DocumentListPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
