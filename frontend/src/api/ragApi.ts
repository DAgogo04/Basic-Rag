import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

export interface DocumentInfo {
  doc_id: string
  filename: string
  chunk_count: number
  status: string
  model_provider: string
  chunk_mode: string
  chunk_size: number
  overlap: number
}

export interface RetrievalHit {
  content: string
  score: number
  rerank_score: number | null
}

export interface QueryResponse {
  answer: string
  contexts: string[]
  retrieval?: RetrievalHit[]
  use_rerank?: boolean
  prompt?: string
}

export async function uploadDocument(
  file: File,
  options: {
    chunk_mode: string
    chunk_size: number
    overlap: number
    model_provider: string
  }
) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('chunk_mode', options.chunk_mode)
  formData.append('chunk_size', String(options.chunk_size))
  formData.append('overlap', String(options.overlap))
  formData.append('model_provider', options.model_provider)

  const res = await api.post('/document/upload', formData)
  return res.data
}

export async function getDocumentList(): Promise<DocumentInfo[]> {
  const res = await api.get('/document/list')
  return res.data
}

export interface ChunkDetail {
  index: number
  token_count: number
  char_count: number
  content: string
  embedding_dim: number
  embedding_preview: number[]
}

export interface ChunkResults {
  doc_id: string
  filename: string
  created_at: string
  config: {
    chunk_mode: string
    chunk_size: number
    overlap: number
    model_provider: string
  }
  total_chunks: number
  chunks: ChunkDetail[]
}

export async function getChunkResults(docId: string): Promise<ChunkResults> {
  const res = await api.get(`/document/${docId}/chunks`)
  return res.data
}

export async function getMilvusData(docId: string): Promise<any> {
  const res = await api.get(`/document/${docId}/milvus`)
  return res.data
}

export async function deleteDocument(docId: string, modelProvider: string = 'openai') {
  const res = await api.delete(`/document/${docId}`, {
    params: { model_provider: modelProvider },
  })
  return res.data
}

export interface AppSettings {
  openai_api_key: string
  openai_base_url: string
  bailian_api_key: string
}

export async function getSettings(): Promise<AppSettings> {
  const res = await api.get('/settings')
  return res.data
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<{ message: string }> {
  const res = await api.post('/settings', settings)
  return res.data
}

export async function queryKnowledge(
  question: string,
  options: {
    model_provider: string
    top_k: number
    use_rerank: boolean
  }
): Promise<QueryResponse> {
  const res = await api.post('/query', {
    question,
    ...options,
  })
  return res.data
}

export interface StreamCallbacks {
  onMetadata: (data: {
    retrieval: RetrievalHit[]
    contexts: string[]
    use_rerank: boolean
    prompt: string
  }) => void
  onDelta: (content: string) => void
  onDone: () => void
  onError: (error: Error) => void
}

export async function queryKnowledgeStream(
  question: string,
  options: {
    model_provider: string
    top_k: number
    use_rerank: boolean
  },
  callbacks: StreamCallbacks,
  signal?: AbortSignal
) {
  try {
    const res = await fetch('/api/query/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, ...options }),
      signal,
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      let currentEvent = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7)
        } else if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6))
          if (currentEvent === 'metadata') {
            callbacks.onMetadata(data)
          } else if (currentEvent === 'delta') {
            callbacks.onDelta(data.content)
          } else if (currentEvent === 'done') {
            callbacks.onDone()
          }
          currentEvent = ''
        }
      }
    }

    if (buffer.trim()) {
      const lines = buffer.split('\n')
      let currentEvent = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7)
        } else if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6))
          if (currentEvent === 'done') {
            callbacks.onDone()
          } else if (currentEvent === 'delta') {
            callbacks.onDelta(data.content)
          }
          currentEvent = ''
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      callbacks.onError(err as Error)
    }
  }
}
