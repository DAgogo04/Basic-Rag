import { useState, useEffect, useCallback, useMemo } from 'react'
import { ArrowPathIcon, TrashIcon, DocumentTextIcon, EyeIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { getDocumentList, deleteDocument, getChunkResults, getMilvusData, DocumentInfo, ChunkResults } from '../api/ragApi'
import { useAppStore } from '../store/appStore'

type TabKey = 'chunks' | 'milvus'

export default function DocumentListPage() {
  const [docs, setDocs] = useState<DocumentInfo[]>([])
  const [loading, setLoading] = useState(false)
  const modelProvider = useAppStore(s => s.modelProvider)

  const [chunkData, setChunkData] = useState<ChunkResults | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [milvusData, setMilvusData] = useState<any>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('chunks')

  const fetchDocs = async () => {
    setLoading(true)
    try {
      const list = await getDocumentList()
      setDocs(list)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDocs() }, [])

  const handleDelete = async (docId: string) => {
    if (!confirm('确定删除该文档？')) return
    try {
      await deleteDocument(docId, modelProvider)
      fetchDocs()
    } catch {
      // ignore
    }
  }

  const handleViewChunks = async (docId: string) => {
    setModalLoading(true)
    setChunkData(null)
    setMilvusData(null)
    setActiveTab('chunks')
    try {
      const [chunks, milvus] = await Promise.all([
        getChunkResults(docId),
        getMilvusData(docId),
      ])
      setChunkData(chunks)
      setMilvusData(milvus)
    } catch {
      // ignore
    } finally {
      setModalLoading(false)
    }
  }

  const closeModal = useCallback(() => {
    setChunkData(null)
    setMilvusData(null)
  }, [])

  const modalOpen = modalLoading || chunkData !== null || milvusData !== null

  useEffect(() => {
    if (!modalOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [modalOpen, closeModal])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-900 font-[Poppins]">文档列表</h2>
        <button
          onClick={fetchDocs}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-all duration-200 ease-out cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <DocumentTextIcon className="w-16 h-16 mb-3 text-gray-300" />
          <p className="text-sm">暂无文档，请先上传</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">文档ID</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">文件名</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">模型</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">分块模式</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">分块数</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docs.map(doc => (
                <tr key={doc.doc_id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-5 py-3 text-sm text-gray-700 font-mono">{doc.doc_id.slice(0, 8)}...</td>
                  <td className="px-5 py-3 text-sm text-gray-700">{doc.filename}</td>
                  <td className="px-5 py-3 text-sm text-gray-700">{doc.model_provider === 'bailian' ? '百炼' : 'OpenAI'}</td>
                  <td className="px-5 py-3 text-sm text-gray-700">{doc.chunk_mode}</td>
                  <td className="px-5 py-3 text-sm text-gray-700">{doc.chunk_count}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        doc.status === 'completed'
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-orange-50 text-orange-700 border border-orange-200'
                      }`}
                    >
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewChunks(doc.doc_id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-blue-600 border border-blue-200 hover:bg-blue-50 transition-all duration-200 ease-out cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <EyeIcon className="w-3.5 h-3.5" />
                        详情
                      </button>
                      <button
                        onClick={() => handleDelete(doc.doc_id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-red-600 border border-red-200 hover:bg-red-50 transition-all duration-200 ease-out cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-[90vw] max-w-5xl h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">分块详情</h3>
                  {chunkData && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {chunkData.filename} — {chunkData.total_chunks} 个分块
                    </p>
                  )}
                </div>
                {/* Tabs */}
                {!modalLoading && (
                  <div className="flex border border-gray-200 rounded-lg overflow-hidden ml-4">
                    <button
                      onClick={() => setActiveTab('chunks')}
                      className={`px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                        activeTab === 'chunks'
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      分块内容
                    </button>
                    <button
                      onClick={() => setActiveTab('milvus')}
                      className={`px-4 py-1.5 text-sm font-medium transition-colors border-l border-gray-200 cursor-pointer ${
                        activeTab === 'milvus'
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      向量数据库
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            {modalLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : activeTab === 'chunks' && chunkData ? (
              <ChunksTab data={chunkData} />
            ) : activeTab === 'milvus' && milvusData ? (
              <MilvusTab data={milvusData} />
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

/* ───── Chunks Tab ───── */
function ChunksTab({ data }: { data: ChunkResults }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span className="text-gray-500">文档 ID: <span className="text-gray-700 font-mono">{data.doc_id.slice(0, 8)}...</span></span>
          <span className="text-gray-500">处理时间: <span className="text-gray-700">{data.created_at}</span></span>
          <span className="text-gray-500">分块模式: <span className="text-gray-700">{data.config.chunk_mode}</span></span>
          <span className="text-gray-500">Chunk Size: <span className="text-gray-700">{data.config.chunk_size}</span></span>
          <span className="text-gray-500">Overlap: <span className="text-gray-700">{data.config.overlap}</span></span>
          <span className="text-gray-500">模型: <span className="text-gray-700">{data.config.model_provider}</span></span>
        </div>
      </div>
      <div className="px-6 py-4 space-y-4">
        {data.chunks.map(chunk => (
          <div key={chunk.index} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-900">Chunk {chunk.index}</span>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{chunk.token_count} tokens</span>
                <span>{chunk.char_count} chars</span>
                <span>Embedding {chunk.embedding_dim}d</span>
              </div>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{chunk.content}</p>
            </div>
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50">
              <p className="text-xs text-gray-400 font-mono truncate">
                embedding: [{chunk.embedding_preview.map(v => v.toFixed(4)).join(', ')} ...]
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───── Milvus Tab ───── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MilvusTab({ data }: { data: any }) {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Schema summary */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span className="text-gray-500">Collection: <span className="text-gray-700 font-mono">{data.collection}</span></span>
          <span className="text-gray-500">记录数: <span className="text-gray-700">{data.total_records}</span></span>
          <span className="text-gray-500">索引: <span className="text-gray-700">{data.schema.index.type} / {data.schema.index.metric}</span></span>
        </div>
      </div>

      <div className="px-6 py-4 space-y-4">
        {/* Collection schema */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-900">Collection Schema</span>
          </div>
          <div className="p-4">
            <JsonBlock data={data.schema} />
          </div>
        </div>

        {/* Each record */}
        {data.records.map((record: any, i: number) => (
          <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-900">Record {i}</span>
              <span className="text-xs text-gray-500 font-mono">id: {record.id}</span>
            </div>
            <div className="p-4">
              <JsonBlock data={record} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───── JSON Pretty Print with Syntax Highlighting ───── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function JsonBlock({ data }: { data: any }) {
  const html = useMemo(() => syntaxHighlight(JSON.stringify(data, null, 2)), [data])
  return (
    <pre
      className="text-sm leading-relaxed overflow-x-auto whitespace-pre font-mono"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function syntaxHighlight(json: string): string {
  return json.replace(
    /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'text-emerald-600' // number
      if (match.startsWith('"')) {
        if (match.endsWith(':')) {
          cls = 'text-blue-600 font-medium' // key
          // Remove the trailing colon from the span, add it back outside
          return `<span class="${cls}">${match.slice(0, -1)}</span>:`
        } else {
          cls = 'text-amber-700' // string value
        }
      } else if (/true|false/.test(match)) {
        cls = 'text-purple-600' // boolean
      } else if (match === 'null') {
        cls = 'text-gray-400' // null
      }
      return `<span class="${cls}">${match}</span>`
    },
  )
}
