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
  // Gemini + tools có thể >8s — cho đủ thời gian trước khi FE fallback local
  return http.post<AiChatResult>(apiPaths.ai.chat, { messages }, { timeoutMs: 45_000 })
}
