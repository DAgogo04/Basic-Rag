import { useState, useRef, useEffect } from 'react'
import { PaperAirplaneIcon, ChevronDownIcon, TrashIcon } from '@heroicons/react/24/solid'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { queryKnowledgeStream } from '../api/ragApi'
import { useAppStore } from '../store/appStore'

export default function ChatWindow() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const store = useAppStore()
  const messages = store.chatMessages
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async () => {
    const question = input.trim()
    if (!question || loading) return

    store.setChatMessages([...messages, { role: 'user', content: question }])
    setInput('')
    setLoading(true)

    store.setChatMessages([...messages, { role: 'user', content: question }, { role: 'assistant', content: '' }])

    await queryKnowledgeStream(
      question,
      {
        model_provider: store.modelProvider,
        top_k: store.topK,
        use_rerank: store.useRerank,
      },
      {
        onMetadata: (data) => {
          store.updateLastMessage({
            retrieval: data.retrieval,
            contexts: data.contexts,
            useRerank: data.use_rerank,
            prompt: data.prompt,
          })
        },
        onDelta: (content) => {
          store.appendToLastMessage(content)
        },
        onDone: () => {
          setLoading(false)
        },
        onError: (error) => {
          store.updateLastMessage({ content: `查询失败: ${error.message}` })
          setLoading(false)
        },
      },
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <ChatBubbleIcon />
            <p className="mt-3 text-sm">输入问题开始问答</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-end gap-2 max-w-[80%]">
              {msg.role === 'user' ? (
                <div className="px-4 py-2.5 rounded-2xl rounded-br-md text-sm leading-relaxed whitespace-pre-wrap bg-blue-600 text-white">
                  {msg.content}
                </div>
              ) : (
                <div className="px-4 py-2.5 rounded-2xl rounded-bl-md text-sm leading-relaxed bg-gray-100 text-gray-900 prose prose-sm prose-gray max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-code:before:content-none prose-code:after:content-none prose-headings:mt-3 prose-headings:mb-1">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {msg.retrieval && msg.retrieval.length > 0 && (
              <details className="mt-2 max-w-[80%] group">
                <summary className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer hover:text-gray-700 transition-colors">
                  <ChevronDownIcon className="w-3 h-3 transition-transform group-open:rotate-180" />
                  检索过程 ({msg.retrieval.length} 条召回{msg.useRerank ? ' · 已 Rerank' : ''})
                </summary>
                <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">Embedding</span>
                    <span>→</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-600 rounded-full font-medium">向量检索 Top {msg.retrieval.length}</span>
                    {msg.useRerank && (
                      <>
                        <span>→</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full font-medium">Rerank 重排</span>
                      </>
                    )}
                    <span>→</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full font-medium">LLM 生成</span>
                  </div>

                  {msg.prompt && (
                    <details className="group/prompt">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 transition-colors font-medium">
                        拼接后的提示词
                      </summary>
                      <pre className="mt-1.5 p-2.5 bg-white border border-gray-100 rounded-lg text-xs text-gray-700 whitespace-pre-wrap break-words max-h-60 overflow-y-auto leading-relaxed">
                        {msg.prompt}
                      </pre>
                    </details>
                  )}

                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {msg.retrieval.map((hit, j) => (
                      <div
                        key={j}
                        className="text-xs leading-relaxed p-2.5 rounded-lg bg-white border border-gray-100"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-medium text-blue-600">#{j + 1}</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px] font-mono">
                            相似度 {(hit.score * 100).toFixed(1)}%
                          </span>
                          {hit.rerank_score != null && (
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-mono">
                              Rerank {hit.rerank_score.toFixed(1)}分
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 line-clamp-3">{hit.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            )}
          </div>
        ))}

        {loading && messages.length > 0 && messages[messages.length - 1].content === '' && (
          <div className="flex items-start" role="status" aria-label="思考中">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-typing-dot" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-typing-dot" style={{ animationDelay: '0.2s' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-typing-dot" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 p-4">
        <div className="flex gap-3">
          {messages.length > 0 && !loading && (
            <button
              onClick={() => store.clearChatMessages()}
              aria-label="清空聊天记录"
              title="清空聊天记录"
              className="px-3 py-2.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          )}
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="输入你的问题..."
            aria-label="输入问题"
            className="flex-1 bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors ease-out"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            aria-label="发送消息"
            className={`px-4 py-2.5 rounded-xl transition-all duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              loading || !input.trim()
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
            }`}
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function ChatBubbleIcon() {
  return (
    <svg className="w-16 h-16 text-slate-500/50" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
    </svg>
  )
}
