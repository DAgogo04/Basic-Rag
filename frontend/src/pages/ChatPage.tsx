import { useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import SettingPanel from '../components/SettingPanel'
import ChatWindow from '../components/ChatWindow'

export default function ChatPage() {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-900 font-[Poppins]">知识库问答</h2>
        <button
          onClick={() => setSettingsOpen(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-all duration-200 ease-out cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {settingsOpen ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
          设置
        </button>
      </div>
      {settingsOpen && <SettingPanel />}
      <ChatWindow />
    </div>
  )
}
