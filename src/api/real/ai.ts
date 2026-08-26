import { http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'

export interface AiStatus {
  configured: boolean
  provider: string
}

export interface AiChatResult {
  content: string
  provider: string
  model: string
  fallback: boolean
}

export function getAiStatus() {
  return http.get<AiStatus>(apiPaths.ai.status)
}

export function chat(messages: { role: string; content: string }[]) {
  // Gemini flash-lite ~2–5s; do not wait 18s then dump local
  return http.post<AiChatResult>(apiPaths.ai.chat, { messages }, { timeoutMs: 10_000 })
}
