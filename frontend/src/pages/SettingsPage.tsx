import { useState, useEffect } from 'react'
import { getSettings, saveSettings } from '../api/ragApi'

const inputClass = 'w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors ease-out font-mono'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

export default function SettingsPage() {
  const [openaiKey, setOpenaiKey] = useState('')
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('')
  const [bailianKey, setBailianKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    getSettings().then(data => {
      setOpenaiKey(data.openai_api_key)
      setOpenaiBaseUrl(data.openai_base_url)
      setBailianKey(data.bailian_api_key)
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await saveSettings({
        openai_api_key: openaiKey,
        openai_base_url: openaiBaseUrl,
        bailian_api_key: bailianKey,
      })
      setMessage({ type: 'success', text: '配置已保存' })
      // 重新加载脱敏后的值
      const data = await getSettings()
      setOpenaiKey(data.openai_api_key)
      setOpenaiBaseUrl(data.openai_base_url)
      setBailianKey(data.bailian_api_key)
    } catch (e: any) {
      setMessage({ type: 'error', text: `保存失败: ${e.message}` })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">API Key 配置</h2>

      <div className="space-y-6">
        {/* OpenAI */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">OpenAI</h3>

          <div>
            <label htmlFor="openai-key" className={labelClass}>API Key</label>
            <input
              id="openai-key"
              type="text"
              value={openaiKey}
              onChange={e => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="openai-url" className={labelClass}>Base URL</label>
            <input
              id="openai-url"
              type="text"
              value={openaiBaseUrl}
              onChange={e => setOpenaiBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className={inputClass}
            />
            <p className="text-xs text-gray-400 mt-1">留空则使用默认地址，可填写兼容 OpenAI 接口的代理地址</p>
          </div>
        </div>

        {/* 百炼 / 通义千问 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">通义千问（百炼）</h3>

          <div>
            <label htmlFor="bailian-key" className={labelClass}>API Key</label>
            <input
              id="bailian-key"
              type="text"
              value={bailianKey}
              onChange={e => setBailianKey(e.target.value)}
              placeholder="sk-..."
              className={inputClass}
            />
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              saving
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
            }`}
          >
            {saving ? '保存中...' : '保存配置'}
          </button>
          {message && (
            <span className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {message.text}
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-6">
        配置将保存在项目目录下的 settings.json 文件中，优先级高于环境变量。修改后立即生效，无需重启服务。
      </p>
    </div>
  )
}
