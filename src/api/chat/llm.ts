import { apiConfig } from '@/api/config'
import * as realAi from '@/api/real/ai'
import { buildLlmGroundingBlock, type VerifiedFacts } from '@/api/chat/verifiedFacts'
import type { ChatMessage } from '@/types'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

/** Cached BE AI status (token stays on server — easy Vercel/Railway deploy). */
let beAiConfigured: boolean | null = null
let beAiStatusAt = 0
const BE_AI_STATUS_TTL_MS = 120_000

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

export async function refreshBeAiStatus(force = false): Promise<boolean> {
  if (
    !force &&
    beAiConfigured !== null &&
    Date.now() - beAiStatusAt < BE_AI_STATUS_TTL_MS
  ) {
    return beAiConfigured === true
  }
  try {
    const status = await realAi.getAiStatus()
    beAiConfigured = Boolean(status.configured)
  } catch {
    beAiConfigured = false
  }
  beAiStatusAt = Date.now()
  return beAiConfigured === true
}

/** true if BE Gemini proxy ready, or optional browser Groq key */
export function isLlmConfigured(): boolean {
  if (beAiConfigured === true) return true
  if (isDirectLlmConfigured()) return true
  // Optimistic while status loads: logged-in users may use BE proxy
  return hasBackendToken() && beAiConfigured !== false
}

export function llmProviderLabel(): string {
  if (beAiConfigured === true) return 'trợ lý trên máy chủ'
  if (isDirectLlmConfigured()) return 'trợ lý trình duyệt'
  if (hasBackendToken()) return 'đang kết nối trợ lý…'
  return 'trợ lý local'
}

/** BE Gemini có system prompt + tools riêng — giới hạn 8000 ký tự/turn. */
const BE_TURN_MAX_CHARS = 3_500

function buildBackendDialogue(
  history: ChatMessage[],
  userMessage: string,
  options?: { recentTurns?: ChatMessage[]; userRole?: string },
): { role: string; content: string }[] {
  const sourceHistory = options?.recentTurns ?? history
  const turns: { role: string; content: string }[] = []
  for (const m of sourceHistory.slice(-6)) {
    if (m.role !== 'user' && m.role !== 'assistant') continue
    let content = m.content.slice(0, BE_TURN_MAX_CHARS)
    if (m.role === 'assistant' && m.products?.length) {
      content += `\n[SP đang bàn: ${m.products.map((p) => p.name).join(', ')}]`
    }
    if (m.role === 'user' && m.attachments?.length) {
      content += `\n[SP đính kèm: ${m.attachments.map((p) => p.name).join(', ')}]`
    }
    turns.push({ role: m.role, content: content.slice(0, BE_TURN_MAX_CHARS) })
  }
  turns.push({ role: 'user', content: userMessage.slice(0, BE_TURN_MAX_CHARS) })
  if (options?.userRole && options.userRole !== 'customer') {
    const last = turns[turns.length - 1]
    last.content = `[Vai trò SEDSP: ${options.userRole}]\n${last.content}`.slice(0, BE_TURN_MAX_CHARS)
  }
  return turns
}

/** Pattern: history + user message → BE Gemini proxy, else optional direct Groq */
export async function callChatLlm(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
  facts?: VerifiedFacts | null,
  options?: { recentTurns?: ChatMessage[]; userRole?: string },
): Promise<string> {
  const grounding = facts ? buildLlmGroundingBlock(facts).trim() : ''
  const groundedUser = [userMessage, grounding].filter(Boolean).join('\n\n')

  const sourceHistory = options?.recentTurns ?? history
  const recent = sourceHistory.slice(-6).map((m) => {
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
    { role: 'system', content: systemPrompt.slice(0, BE_TURN_MAX_CHARS) },
    ...recent,
    { role: 'user', content: groundedUser.slice(0, BE_TURN_MAX_CHARS) },
  ]

  if (hasBackendToken() && beAiConfigured !== false) {
    try {
      if (beAiConfigured === null) {
        await refreshBeAiStatus()
      }
      if (beAiConfigured) {
        const beMessages = buildBackendDialogue(history, groundedUser, {
          recentTurns: options?.recentTurns,
          userRole: options?.userRole,
        })
        const res = await realAi.chat(beMessages)
        // Soft fallback message from BE (no key) — still usable as reply text
        if (res.content?.trim()) {
          if (res.fallback) {
            console.warn('[chat] BE AI fallback flag; using returned content')
          }
          return res.content.trim()
        }
        if (res.fallback) {
          throw new Error('BE AI chưa cấu hình (fallback)')
        }
      }
    } catch (e) {
      // Prefer surfacing BE Gemini errors over silent local-only replies
      if (!isDirectLlmConfigured()) {
        throw e instanceof Error ? e : new Error('BE AI chat failed')
      }
    }
  }

  if (!isDirectLlmConfigured()) {
    throw new Error('LLM chưa cấu hình')
  }

  const url = `${apiConfig.aiBaseUrl.replace(/\/$/, '')}/chat/completions`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)
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
        temperature: 0.55,
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
