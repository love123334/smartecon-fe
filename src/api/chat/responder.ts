import type { ChatContext } from '@/api/chat/context'
import { enrichChatContext } from '@/api/chat/enrich'
import { generateAssistantReply } from '@/api/chat/engine'
import { detectIntent, type ChatIntent } from '@/api/chat/intents'
import { callChatLlm, isLlmConfigured, llmProviderLabel, refreshBeAiStatus } from '@/api/chat/llm'
import { extractPriceRange } from '@/api/chat/products'
import { buildSystemPrompt } from '@/api/chat/systemPrompt'
import type { ChatMessage, ChatProductRef } from '@/types'

export type ChatReplySource = 'llm' | 'local'

export interface ChatReply {
  content: string
  source: ChatReplySource
  products?: ChatProductRef[]
}

const FORCE_LOCAL_INTENTS = new Set<ChatIntent>([
  'product_budget',
  'product_search',
  'product_cheapest',
  'category_browse',
  'compare',
  'product_info',
  'product_price',
  'product_stock',
  'recommend',
])

/** Khi có LLM: ưu tiên AI + context shop; local chỉ fallback. Shopping/filter → local có card. */
export async function resolveChatReply(
  userMessage: string,
  history: ChatMessage[],
  ctx: ChatContext,
  attachments?: ChatProductRef[],
): Promise<ChatReply> {
  const detected = detectIntent(userMessage, ctx.role)
  const enriched = await enrichChatContext(ctx, userMessage, detected?.intent ?? null)
  const intent = detected?.intent ?? null
  const hasPriceFilter = Boolean(extractPriceRange(userMessage))
  const forceLocal =
    Boolean(attachments?.length) ||
    hasPriceFilter ||
    (intent != null && FORCE_LOCAL_INTENTS.has(intent))

  if (!forceLocal && isLlmConfigured()) {
    try {
      const systemPrompt = buildSystemPrompt(enriched)
      const content = await callChatLlm(systemPrompt, history, userMessage)
      // Vẫn lấy card local nếu có kết quả lọc SP
      const local = await generateAssistantReply(userMessage, enriched, attachments)
      return {
        content,
        source: 'llm',
        products: local.products,
      }
    } catch {
      /* fallback local */
    }
  }

  const local = await generateAssistantReply(userMessage, enriched, attachments)
  return {
    content: local.content,
    source: 'local',
    products: local.products,
  }
}

export function chatModeLabel(): string {
  return isLlmConfigured()
    ? `AI (${llmProviderLabel()}) + local data`
    : 'Trợ lý thông minh (local)'
}

/** Call once when opening chatbot so BE AI status is known */
export { refreshBeAiStatus }
