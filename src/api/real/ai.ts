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
  // Gemini ~8s + DeepSeek polish ~6s — one advisor reply within ~15s
  return http.post<AiChatResult>(apiPaths.ai.chat, { messages }, { timeoutMs: 16_000 })
}
