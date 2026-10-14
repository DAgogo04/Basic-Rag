import { useAppStore } from '../store/appStore'

const selectClass = 'bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors ease-out appearance-none cursor-pointer'
const inputClass = 'bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors ease-out'

const chunkModes = [
  { value: 'sliding', label: '滑动窗口', desc: '按固定 token 窗口滑动切分，通过 Overlap 保留上下文衔接' },
  { value: 'semantic', label: '语义分块', desc: '由大模型按语义自动划分段落，无需指定长度和重叠' },
  { value: 'hybrid', label: '混合模式', desc: '先由大模型语义分块，再对超长块用滑动窗口裁剪' },
]

export default function SettingPanel() {
  const store = useAppStore()
  const hideSizeOverlap = store.chunkMode === 'semantic'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
      {/* Chunk mode descriptions */}
      <div className="grid grid-cols-3 gap-3">
        {chunkModes.map(m => (
          <button
            key={m.value}
            type="button"
            onClick={() => store.setChunkMode(m.value)}
            className={`text-left px-3.5 py-3 rounded-lg border transition-all duration-150 cursor-pointer ${
              store.chunkMode === m.value
                ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <p className={`text-sm font-medium ${store.chunkMode === m.value ? 'text-blue-600' : 'text-gray-900'}`}>
              {m.label}
            </p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{m.desc}</p>
          </button>
        ))}
      </div>

      {/* Settings grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="setting-model" className="text-sm text-gray-600">模型</label>
          <select
            id="setting-model"
            value={store.modelProvider}
            onChange={e => store.setModelProvider(e.target.value)}
            className={selectClass}
          >
            <option value="openai" className="bg-white text-gray-900">OpenAI</option>
            <option value="bailian" className="bg-white text-gray-900">百炼</option>
          </select>
        </div>

        {!hideSizeOverlap && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="setting-chunk-size" className="text-sm text-gray-600">Chunk Size</label>
            <input
              id="setting-chunk-size"
              type="number"
              value={store.chunkSize}
              onChange={e => store.setChunkSize(Number(e.target.value))}
              className={inputClass}
            />
          </div>
        )}

        {!hideSizeOverlap && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="setting-overlap" className="text-sm text-gray-600">Overlap</label>
            <input
              id="setting-overlap"
              type="number"
              value={store.overlap}
              onChange={e => store.setOverlap(Number(e.target.value))}
              className={inputClass}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="setting-topk" className="text-sm text-gray-600">Top K</label>
          <input
            id="setting-topk"
            type="number"
            value={store.topK}
            onChange={e => store.setTopK(Number(e.target.value))}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-gray-600" id="setting-rerank-label">Rerank</span>
          <div className="flex items-center gap-2 py-2">
            <button
              type="button"
              role="switch"
              aria-checked={store.useRerank}
              aria-labelledby="setting-rerank-label"
              onClick={() => store.setUseRerank(!store.useRerank)}
              className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 outline-none ${
                store.useRerank ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ease-out ${
                  store.useRerank ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-sm text-gray-600">{store.useRerank ? '已启用' : '已关闭'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
