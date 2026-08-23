import type { ConversationContext } from '@/api/chat/conversationContext'
import type { ChatIntent } from '@/api/chat/intents'
import { normalizeText } from '@/api/chat/match'
import type { ChatMessage, ChatProductRef, UserRole } from '@/types'
import type { ChatRoute } from '@/api/chat/intentRouter'

export const RECENT_TURN_LIMIT = 6
export const SUMMARY_MAX_CHARS = 600

export interface ChatMemoryLayers {
  recentTurns: ChatMessage[]
  summary: string
  goal: string
  sessionContext: SessionContextPayload
}

export interface SessionContextPayload {
  user: { role: UserRole; name?: string }
  route: ChatRoute
  intent?: ChatIntent
  conversation: {
    activeTask: ConversationContext['activeTask']
    currentProduct?: { id: string; name: string; price?: number }
    lastProductNames: string[]
    goal: string
    topic?: ConversationContext['topic']
    userGoal?: string
    currentCategory?: string
    budget?: number
    lastAnalysis?: string
  }
}

function uniqueLines(lines: string[]): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    const key = line.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out.join('\n').slice(0, SUMMARY_MAX_CHARS)
}

/** Tóm tắt rule-based các lượt cũ — không gọi LLM thêm. */
export function summarizeOlderTurns(
  older: ChatMessage[],
  conversation: ConversationContext,
): string {
  if (!older.length) return conversation.summary?.trim() ?? ''

  const lines: string[] = []
  if (conversation.summary?.trim()) lines.push(conversation.summary.trim())

  const userTopics = older
    .filter((m) => m.role === 'user')
    .map((m) => m.content.trim())
    .filter((t) => t.length >= 4 && t.length <= 120)
    .slice(-4)
  for (const t of userTopics) {
    lines.push(`User đã hỏi: ${t}`)
  }

  const productNames = new Set<string>()
  for (const m of older) {
    for (const p of [...(m.products ?? []), ...(m.attachments ?? [])]) {
      if (p.name) productNames.add(p.name)
    }
  }
  if (productNames.size) {
    lines.push(`SP đã nhắc: ${[...productNames].slice(0, 5).join(', ')}`)
  }

  if (conversation.lastIntent) {
    lines.push(`Chủ đề gần đây: ${conversation.lastIntent}`)
  }

  return uniqueLines(lines)
}

export function deriveConversationGoal(
  conversation: ConversationContext,
  history: ChatMessage[],
  intent: ChatIntent | null,
  role: UserRole = 'customer',
): string {
  if (conversation.goal?.trim()) return conversation.goal.trim()

  if (role === 'seller' && intent && intent.startsWith('seller_')) {
    return `Vận hành shop: ${intent.replace(/^seller_/, '').replace(/_/g, ' ')}`
  }
  if (role === 'manager' && intent && intent.startsWith('manager_')) {
    return `Quản lý sàn: ${intent.replace(/^manager_/, '').replace(/_/g, ' ')}`
  }

  if (conversation.currentCategory && conversation.budget) {
    return `Tìm ${conversation.currentCategory} tầm ~${Math.round(conversation.budget / 1_000_000)} triệu`
  }
  if (conversation.currentCategory) {
    return `Duyệt / gợi ý ${conversation.currentCategory}`
  }
  if (conversation.budget) {
    return `Mua sắm trong ngân sách ~${Math.round(conversation.budget / 1_000_000)} triệu`
  }
  if (conversation.userGoal === 'analyze_sales') {
    return 'Phân tích doanh số / bán chạy'
  }

  const focus = conversation.currentProduct?.name
  if (focus) {
    if (conversation.activeTask === 'compare') {
      return `So sánh / đánh giá sản phẩm (focus: ${focus})`
    }
    if (conversation.activeTask === 'browse') {
      return `Tìm / duyệt sản phẩm liên quan ${focus}`
    }
    if (conversation.activeTask === 'product_qa') {
      return `Hỏi đáp chi tiết về ${focus}`
    }
    return `Đang làm việc với sản phẩm ${focus}`
  }

  const lastUser = [...history].reverse().find((m) => m.role === 'user')?.content
  if (lastUser && intent) {
    return `Trả lời: ${lastUser.slice(0, 80)} (${intent})`
  }
  if (lastUser) return `Trả lời: ${lastUser.slice(0, 80)}`

  if (role === 'seller') return 'Hỗ trợ doanh số, DSS và đơn bán'
  if (role === 'manager') return 'Hỗ trợ KPI và vận hành sàn'
  return 'Tư vấn mua sắm & theo dõi đơn trên SEDSP'
}

export function buildChatMemoryLayers(
  history: ChatMessage[],
  conversation: ConversationContext,
  intent: ChatIntent | null,
  role: UserRole,
  route: ChatRoute,
  userName?: string,
): ChatMemoryLayers {
  const recentTurns = history.slice(-RECENT_TURN_LIMIT)
  const older = history.length > RECENT_TURN_LIMIT ? history.slice(0, -RECENT_TURN_LIMIT) : []
  const summary = summarizeOlderTurns(older, conversation)
  const goal = deriveConversationGoal(conversation, history, intent, role)

  const sessionContext: SessionContextPayload = {
    user: { role, name: userName },
    route,
    intent: intent ?? undefined,
    conversation: {
      activeTask: conversation.activeTask,
      currentProduct: conversation.currentProduct
        ? {
            id: String(conversation.currentProduct.id),
            name: conversation.currentProduct.name,
            price: conversation.currentProduct.price,
          }
        : undefined,
      lastProductNames: conversation.lastResults.map((p) => p.name).slice(0, 4),
      goal,
      topic: conversation.topic,
      userGoal: conversation.userGoal,
      currentCategory: conversation.currentCategory,
      budget: conversation.budget,
      lastAnalysis: conversation.lastAnalysis,
    },
  }

  return { recentTurns, summary, goal, sessionContext }
}

/** Cập nhật summary/goal sau mỗi lượt — lưu vào session. */
export function refreshConversationMemoryFields(
  prev: ConversationContext,
  input: {
    userMessage: string
    intent: ChatIntent | null
    products?: ChatProductRef[]
    conversation?: ConversationContext
  },
): ConversationContext {
  const normalized = normalizeText(input.userMessage)
  let goal = prev.goal ?? ''
  const conv = input.conversation ?? prev

  if (input.products?.[0]?.name) {
    goal = `Tập trung SP: ${input.products[0].name}`
  } else if (conv.currentCategory && conv.budget) {
    goal = `Tìm ${conv.currentCategory} ~${Math.round(conv.budget / 1_000_000)} triệu`
  } else if (conv.currentCategory) {
    goal = `Duyệt ${conv.currentCategory}`
  } else if (conv.budget) {
    goal = `Ngân sách ~${Math.round(conv.budget / 1_000_000)} triệu`
  } else if (/so sanh|compare/.test(normalized)) {
    goal = 'So sánh sản phẩm đang bàn'
  } else if (/what\s*if|giam gia|giam \d|mo phong/.test(normalized)) {
    goal = 'Phân tích what-if / giảm giá'
  } else if (/doanh thu|ban chay|top sp|revenue/.test(normalized)) {
    goal = 'Phân tích doanh số / bán chạy'
  } else if (/ton kho|inventory|het hang|nhap hang/.test(normalized)) {
    goal = 'Theo dõi tồn kho'
  } else if (input.intent === 'product_search' || input.intent === 'recommend') {
    goal = `Tìm sản phẩm: ${input.userMessage.slice(0, 60)}`
  }

  const summaryParts: string[] = []
  if (prev.summary?.trim()) summaryParts.push(prev.summary.trim())
  if (input.userMessage.trim().length >= 4) {
    summaryParts.push(`Lượt gần nhất: ${input.userMessage.trim().slice(0, 100)}`)
  }
  if (input.intent) summaryParts.push(`Intent: ${input.intent}`)

  return {
    ...prev,
    goal,
    summary: uniqueLines(summaryParts),
    updatedAt: new Date().toISOString(),
  }
}
