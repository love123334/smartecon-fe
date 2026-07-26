import type { ChatContext } from '@/api/chat/context'
import { enrichChatContext } from '@/api/chat/enrich'
import { generateAssistantReply } from '@/api/chat/engine'
import { detectIntent, type ChatIntent } from '@/api/chat/intents'
import { callChatLlm, isLlmConfigured } from '@/api/chat/llm'
import { buildSystemPrompt } from '@/api/chat/systemPrompt'
import type { ChatMessage } from '@/types'

export type ChatReplySource = 'llm' | 'local'

export interface ChatReply {
  content: string
  source: ChatReplySource
}

/** Intent cần dữ liệu catalog/đơn chính xác — ưu tiên engine local */
const LOCAL_FIRST_INTENTS = new Set<ChatIntent>([
  'shop_overview',
  'categories',
  'category_browse',
  'product_search',
  'product_cheapest',
  'product_budget',
  'product_price',
  'product_stock',
  'product_info',
  'product_review',
  'compare',
  'cart',
  'cart_summary',
  'orders',
  'order_detail',
  'order_cancel',
  'contact_seller',
  'seller_revenue',
  'seller_inventory',
  'seller_orders',
  'seller_recent_orders',
  'seller_top_products',
  'manager_kpi',
  'manager_pending',
  'manager_revenue',
  'admin_users',
  'admin_system',
])

/** LLM (Groq/OpenAI) nếu có key — fallback / ưu tiên local cho câu hỏi dữ liệu */
export async function resolveChatReply(
  userMessage: string,
  history: ChatMessage[],
  ctx: ChatContext,
): Promise<ChatReply> {
  const detected = detectIntent(userMessage, ctx.role)
  const enriched = await enrichChatContext(ctx, userMessage, detected?.intent ?? null)

  const preferLocal = detected != null && LOCAL_FIRST_INTENTS.has(detected.intent)

  if (preferLocal) {
    return {
      content: await generateAssistantReply(userMessage, enriched),
      source: 'local',
    }
  }

  if (isLlmConfigured()) {
    try {
      const systemPrompt = buildSystemPrompt(enriched)
      const content = await callChatLlm(systemPrompt, history, userMessage)
      return { content, source: 'llm' }
    } catch {
      /* fallback local */
    }
  }

  return {
    content: await generateAssistantReply(userMessage, enriched),
    source: 'local',
  }
}

export function chatModeLabel(): string {
  return isLlmConfigured() ? 'AI (Groq/OpenAI) + local data' : 'Trợ lý thông minh (local)'
}
