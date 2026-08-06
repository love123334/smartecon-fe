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
  // Chat AI: cap 2s — hết giờ thì FE fallback rule-based, không treo
  return http.post<AiChatResult>(apiPaths.ai.chat, { messages }, { timeoutMs: 2_000 })
}
