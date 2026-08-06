import { apiConfig } from '@/api/config'
import * as realAi from '@/api/real/ai'
import type { ChatMessage } from '@/types'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

/** Cached BE Hugging Face status (token stays on server — easy Vercel/Railway deploy). */
let beAiConfigured: boolean | null = null

function hasBackendToken(): boolean {
  return Boolean(localStorage.getItem('sedsp_access_token')?.trim())
}

function isDirectLlmConfigured(): boolean {
  // Production builds should not ship browser API keys — prefer BE proxy only
  if (import.meta.env.PROD && import.meta.env.VITE_ALLOW_BROWSER_AI !== 'true') {
    return false
  }
  return apiConfig.aiEnabled && Boolean(apiConfig.aiApiKey?.trim())
}

export async function refreshBeAiStatus(): Promise<boolean> {
  if (!hasBackendToken()) {
    beAiConfigured = false
    return false
  }
  try {
    const status = await realAi.getAiStatus()
    beAiConfigured = Boolean(status.configured)
  } catch {
    beAiConfigured = false
  }
  return beAiConfigured
}

/** true if BE HF proxy ready, or optional browser Groq key */
export function isLlmConfigured(): boolean {
  if (beAiConfigured === true) return true
  if (isDirectLlmConfigured()) return true
  // Optimistic: authenticated users may use BE proxy — callChatLlm will verify
  return hasBackendToken() && beAiConfigured !== false
}

export function llmProviderLabel(): string {
  if (beAiConfigured === true) return 'OpenRouter/AI (via backend)'
  if (isDirectLlmConfigured()) return 'Groq/OpenAI (browser)'
  if (hasBackendToken()) return 'Backend AI (checking…)'
  return 'Local'
}

/** Pattern: history + user message → BE HF proxy, else optional direct Groq */
export async function callChatLlm(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
): Promise<string> {
  const recent = history.slice(-12).map((m) => {
    let content = m.content.slice(0, 1600)
    if (m.role === 'assistant' && m.products?.length) {
      content += `\n[SP đang bàn: ${m.products.map((p) => p.name).join(', ')}]`
    }
    if (m.role === 'user' && m.attachments?.length) {
      content += `\n[SP đính kèm: ${m.attachments.map((p) => p.name).join(', ')}]`
    }
    return {
      role: m.role as 'user' | 'assistant',
      content,
    }
  })

  const messages: LlmMessage[] = [
    { role: 'system', content: systemPrompt },
    ...recent,
    { role: 'user', content: userMessage },
  ]

  if (hasBackendToken() && beAiConfigured !== false) {
    try {
      if (beAiConfigured === null) {
        await refreshBeAiStatus()
      }
      if (beAiConfigured) {
        const res = await realAi.chat(messages)
        if (res.content?.trim()) return res.content.trim()
      }
    } catch {
      /* fall through to direct LLM or throw */
    }
  }

  if (!isDirectLlmConfigured()) {
    throw new Error('LLM chưa cấu hình')
  }

  const url = `${apiConfig.aiBaseUrl.replace(/\/$/, '')}/chat/completions`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2_000)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.aiApiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: apiConfig.aiModel,
        messages,
        temperature: 0.75,
        max_tokens: 900,
        top_p: 0.9,
      }),
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('LLM timeout (>2s)')
    }
    throw e
  } finally {
    clearTimeout(timer)
  }

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
