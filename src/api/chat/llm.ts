import { apiConfig } from '@/api/config'
import type { ChatMessage } from '@/types'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

/** Pattern giống Bedrock/Claude demo: history + user message → LLM */
export function isLlmConfigured(): boolean {
  return apiConfig.aiEnabled && Boolean(apiConfig.aiApiKey?.trim())
}

export async function callChatLlm(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
): Promise<string> {
  if (!isLlmConfigured()) {
    throw new Error('LLM chưa cấu hình')
  }

  const recent = history.slice(-12).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const messages: LlmMessage[] = [
    { role: 'system', content: systemPrompt },
    ...recent,
    { role: 'user', content: userMessage },
  ]

  const url = `${apiConfig.aiBaseUrl.replace(/\/$/, '')}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.aiApiKey}`,
    },
    body: JSON.stringify({
      model: apiConfig.aiModel,
      messages,
      temperature: 0.6,
      max_tokens: 900,
      top_p: 0.9,
    }),
  })

  let body: ChatCompletionResponse
  try {
    body = await res.json()
  } catch {
    throw new Error(`LLM phản hồi không hợp lệ (HTTP ${res.status})`)
  }

  if (!res.ok) {
    throw new Error(body.error?.message ?? `LLM lỗi HTTP ${res.status}`)
  }

  const text = body.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('LLM không trả về nội dung')
  return text
}
