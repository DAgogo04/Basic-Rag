import { useState, useRef, useCallback } from 'react'
import { CloudArrowUpIcon, DocumentIcon } from '@heroicons/react/24/outline'
import { uploadDocument } from '../api/ragApi'
import { useAppStore } from '../store/appStore'

export default function FileUploader() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<string>('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const store = useAppStore()

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setResult('')
    try {
      const data = await uploadDocument(file, {
        chunk_mode: store.chunkMode,
        chunk_size: store.chunkSize,
        overlap: store.overlap,
        model_provider: store.modelProvider,
      })
      if (data.error) {
        setResult(`上传失败: ${data.error}`)
      } else {
        setResult(`上传成功! 文档ID: ${data.doc_id}, 分块数: ${data.chunk_count}`)
      }
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (e: any) {
      setResult(`上传失败: ${e.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      setFile(droppedFile)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="拖拽或点击选择文件上传"
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-blue-500 outline-none ${
          dragOver
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          aria-label="选择文件"
          onChange={e => setFile(e.target.files?.[0] || null)}
          className="hidden"
        />
        <CloudArrowUpIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-500 text-sm">
          拖拽文件到此处，或 <span className="text-blue-600 underline">点击选择</span>
        </p>
        <p className="text-gray-400 text-xs mt-1">支持 PDF、DOCX、TXT、MD 格式</p>
      </div>

      {file && (
        <div className="mt-4 flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <DocumentIcon className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className={`px-5 py-2 rounded-lg text-sm font-medium text-white transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-blue-500 outline-none ${
              uploading
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
            }`}
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                上传中...
              </span>
            ) : (
              '上传并处理'
            )}
          </button>
        </div>
      )}

      {result && (
        <div
          role="alert"
          className={`mt-4 px-4 py-3 rounded-xl text-sm ${
            result.includes('失败')
              ? 'bg-red-50 text-red-600 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}
        >
          {result}
        </div>
      )}
    </div>
  )
}
