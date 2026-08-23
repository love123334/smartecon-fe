import type { OrderQuerySpec } from '@/api/chat/orderQuery'
import { parseOrderQuery } from '@/api/chat/orderQuery'
import type { ChatIntent } from '@/api/chat/intents'
import { isClearTopicSwitch } from '@/api/chat/followup'
import { refreshConversationMemoryFields } from '@/api/chat/conversationMemory'
import { deriveStateFromTurn } from '@/api/chat/insightEngine'
import { normalizeText } from '@/api/chat/match'
import type { ChatCategory } from '@/api/chat/context'
import type { ChatMessage, ChatProductRef } from '@/types'

/** Nhiệm vụ đang làm — working memory ngắn hạn, không lưu sở thích lâu dài. */
export type ActiveTask =
  | 'general'
  | 'browse'
  | 'product_qa'
  | 'compare'
  | 'order'
  | 'cart'
  | 'seller_ops'
  | 'manager_ops'

export type ConversationTopic =
  | 'catalog_overview'
  | 'product_recommendation'
  | 'product_qa'
  | 'seller_analytics'
  | 'general'

export interface ConversationContext {
  currentProduct?: ChatProductRef
  lastResults: ChatProductRef[]
  activeTask: ActiveTask
  lastIntent?: ChatIntent
  /** Tóm tắt các lượt cũ — không gửi full history cho LLM. */
  summary?: string
  /** Mục tiêu phiên hiện tại (SP đang bàn, what-if, …). */
  goal?: string
  /** Chủ đề hội thoại — giúp follow-up không reset về zero. */
  topic?: ConversationTopic
  userGoal?: string
  currentCategory?: string
  budget?: number
  lastAnalysis?: string
  lastInsightType?: string
  /** Spec truy vấn đơn — giữ temporal/status cho follow-up */
  orderQuerySpec?: OrderQuerySpec
  updatedAt: string
}

export const emptyConversationContext = (): ConversationContext => ({
  lastResults: [],
  activeTask: 'general',
  updatedAt: new Date().toISOString(),
})

function taskForIntent(intent: ChatIntent | null | undefined): ActiveTask {
  if (!intent) return 'general'
  if (intent === 'compare') return 'compare'
  if (
    intent === 'orders' ||
    intent === 'order_detail' ||
    intent === 'order_cancel' ||
    intent === 'checkout'
  ) {
    return 'order'
  }
  if (intent === 'cart' || intent === 'cart_summary') return 'cart'
  if (
    intent === 'product_search' ||
    intent === 'product_cheapest' ||
    intent === 'product_budget' ||
    intent === 'category_browse' ||
    intent === 'recommend'
  ) {
    return 'browse'
  }
  if (
    intent.startsWith('seller_') ||
    intent === 'seller_pricing' ||
    intent === 'seller_whatif'
  ) {
    return 'seller_ops'
  }
  if (intent.startsWith('manager_')) return 'manager_ops'
  if (
    intent === 'product_price' ||
    intent === 'product_stock' ||
    intent === 'product_info' ||
    intent === 'product_review' ||
    intent === 'contact_seller' ||
    intent === 'where_to_buy'
  ) {
    return 'product_qa'
  }
  return 'general'
}

function productsFromHistory(history: ChatMessage[]): ChatProductRef[] {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i]
    if (m.products?.length) return m.products.slice(0, 4)
    if (m.attachments?.length) return m.attachments.slice(0, 4)
  }
  return []
}

/** Khởi tạo working memory từ lịch sử + đính kèm hiện tại. */
export function buildConversationContext(
  history: ChatMessage[],
  attachments?: ChatProductRef[],
): ConversationContext {
  const base = emptyConversationContext()
  const fromHistory = productsFromHistory(history)
  const focus = attachments?.[0] ?? fromHistory[0]
  const lastResults = attachments?.length ? attachments.slice(0, 4) : fromHistory

  return {
    ...base,
    currentProduct: focus,
    lastResults,
    activeTask: focus ? 'product_qa' : lastResults.length ? 'browse' : 'general',
    updatedAt: new Date().toISOString(),
  }
}

export interface ConversationTurnInput {
  userMessage: string
  intent: ChatIntent | null
  products?: ChatProductRef[]
  attachments?: ChatProductRef[]
  categories?: ChatCategory[]
}

/** Cập nhật working memory sau mỗi lượt. */
export function updateConversationContext(
  prev: ConversationContext,
  turn: ConversationTurnInput,
): ConversationContext {
  const normalized = normalizeText(turn.userMessage)
  if (isClearTopicSwitch(normalized)) {
    return {
      ...emptyConversationContext(),
      activeTask: taskForIntent(turn.intent),
      lastIntent: turn.intent ?? undefined,
      orderQuerySpec: undefined,
      updatedAt: new Date().toISOString(),
    }
  }

  const attachmentFocus = turn.attachments?.[0]
  const resultProducts = turn.products?.length ? turn.products.slice(0, 4) : prev.lastResults
  const focus =
    attachmentFocus ??
    turn.products?.[0] ??
    (turn.intent && taskForIntent(turn.intent) === 'product_qa' ? prev.currentProduct : undefined) ??
    resultProducts[0]

  const task = turn.intent ? taskForIntent(turn.intent) : prev.activeTask

  const withMemory = refreshConversationMemoryFields(prev, {
    userMessage: turn.userMessage,
    intent: turn.intent,
    products: turn.products,
    conversation: prev,
  })

  const stateDelta = deriveStateFromTurn(
    turn.userMessage,
    turn.intent,
    turn.categories ?? [],
    turn.products,
  )

  let orderQuerySpec = prev.orderQuerySpec
  if (
    turn.intent === 'orders' ||
    turn.intent === 'order_detail' ||
    turn.intent === 'order_cancel' ||
    task === 'order'
  ) {
    orderQuerySpec = parseOrderQuery(turn.userMessage, prev.orderQuerySpec).spec
  }

  return {
    currentProduct: focus,
    lastResults: turn.products?.length ? turn.products.slice(0, 4) : prev.lastResults,
    activeTask: focus && task === 'general' ? 'product_qa' : task,
    lastIntent: turn.intent ?? prev.lastIntent,
    summary: withMemory.summary,
    goal: withMemory.goal,
    topic: (stateDelta.topic as ConversationContext['topic']) ?? prev.topic,
    userGoal: stateDelta.userGoal ?? prev.userGoal,
    currentCategory: stateDelta.currentCategory ?? prev.currentCategory,
    budget: stateDelta.budget ?? prev.budget,
    lastAnalysis: stateDelta.lastAnalysis ?? prev.lastAnalysis,
    lastInsightType: stateDelta.lastAnalysis ?? prev.lastInsightType,
    orderQuerySpec,
    updatedAt: new Date().toISOString(),
  }
}
