import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RetrievalHit } from '../api/ragApi'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  contexts?: string[]
  retrieval?: RetrievalHit[]
  useRerank?: boolean
  prompt?: string
}

interface AppState {
  modelProvider: string
  chunkMode: string
  chunkSize: number
  overlap: number
  topK: number
  useRerank: boolean
  chatMessages: ChatMessage[]
  setModelProvider: (v: string) => void
  setChunkMode: (v: string) => void
  setChunkSize: (v: number) => void
  setOverlap: (v: number) => void
  setTopK: (v: number) => void
  setUseRerank: (v: boolean) => void
  setChatMessages: (msgs: ChatMessage[]) => void
  updateLastMessage: (partial: Partial<ChatMessage>) => void
  appendToLastMessage: (content: string) => void
  clearChatMessages: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      modelProvider: 'openai',
      chunkMode: 'sliding',
      chunkSize: 500,
      overlap: 100,
      topK: 5,
      useRerank: true,
      chatMessages: [],
      setModelProvider: (v) => set({ modelProvider: v }),
      setChunkMode: (v) => set({ chunkMode: v }),
      setChunkSize: (v) => set({ chunkSize: v }),
      setOverlap: (v) => set({ overlap: v }),
      setTopK: (v) => set({ topK: v }),
      setUseRerank: (v) => set({ useRerank: v }),
      setChatMessages: (msgs) => set({ chatMessages: msgs }),
      updateLastMessage: (partial) =>
        set((state) => {
          const msgs = [...state.chatMessages]
          if (msgs.length === 0) return state
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], ...partial }
          return { chatMessages: msgs }
        }),
      appendToLastMessage: (content) =>
        set((state) => {
          const msgs = [...state.chatMessages]
          if (msgs.length === 0) return state
          const last = msgs[msgs.length - 1]
          msgs[msgs.length - 1] = { ...last, content: last.content + content }
          return { chatMessages: msgs }
        }),
      clearChatMessages: () => set({ chatMessages: [] }),
    }),
    {
      name: 'rag-knowledgebase-store',
      partialize: (state) => ({ chatMessages: state.chatMessages }),
    },
  ),
)
