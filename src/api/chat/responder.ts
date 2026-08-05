import type { ChatContext } from '@/api/chat/context'
import { enrichChatContext } from '@/api/chat/enrich'
import { generateAssistantReply } from '@/api/chat/engine'
import { isProductFollowUp, lastDiscussedProducts } from '@/api/chat/followup'
import { detectIntent, type ChatIntent } from '@/api/chat/intents'
import { callChatLlm, isLlmConfigured, llmProviderLabel, refreshBeAiStatus } from '@/api/chat/llm'
import { normalizeText } from '@/api/chat/match'
import { extractPriceRange } from '@/api/chat/products'
import { sanitizeChatReply } from '@/api/chat/responses'
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
  'where_to_buy',
  'contact_seller',
  'orders',
  'order_detail',
  'order_cancel',
  'cart',
  'cart_summary',
  'shop_overview',
  // Seller DSS — factual from APIs / local engine, not free-form LLM
  'seller_dss_demand',
  'seller_dss_price',
  'seller_dss_inventory',
  'seller_whatif',
  'seller_pricing',
])

function resolveFollowUpIntent(
  normalized: string,
  detected: { intent: ChatIntent; score: number } | null,
): { intent: ChatIntent; score: number } {
  if (/gia|bao nhieu|how much|price|cost|tien/.test(normalized)) {
    return { intent: 'product_price', score: 50 }
  }
  if (/con hang|het hang|ton|stock|available|con khong|con bao nhieu/.test(normalized)) {
    return { intent: 'product_stock', score: 50 }
  }
  if (/review|danh gia|sao|tot khong|ngon khong/.test(normalized)) {
    return { intent: 'product_review', score: 50 }
  }
  if (/so sanh|compare|vs|khac nhau/.test(normalized)) {
    return { intent: 'compare', score: 50 }
  }
  if (
    !detected ||
    detected.intent === 'platform' ||
    detected.intent === 'help' ||
    detected.intent === 'greeting'
  ) {
    return { intent: 'product_info', score: 50 }
  }
  return detected
}

/** When LLM succeeds: still need cards from local engine, but skip if local already ran. */
export async function resolveChatReply(
  userMessage: string,
  history: ChatMessage[],
  ctx: ChatContext,
  attachments?: ChatProductRef[],
): Promise<ChatReply> {
  const normalized = normalizeText(userMessage)
  const priorProducts = lastDiscussedProducts(history)
  const followUp =
    !attachments?.length && priorProducts.length > 0 && isProductFollowUp(normalized)
  const effectiveAttachments =
    attachments?.length ? attachments : followUp ? priorProducts.slice(0, 2) : undefined

  let detected = detectIntent(userMessage, ctx.role)
  if (followUp) {
    detected = resolveFollowUpIntent(normalized, detected)
  }

  const enriched = await enrichChatContext(ctx, userMessage, detected?.intent ?? null)

  // Gắn SP đang follow-up vào enrichment khi câu hỏi không nhắc tên
  let ctxForReply = enriched
  if (followUp && priorProducts[0] && !enriched.enrichment?.product) {
    const focusId = String(priorProducts[0].id)
    const catalog =
      enriched.role === 'seller' && enriched.sellerProducts.length
        ? enriched.sellerProducts
        : enriched.products
    const focus =
      catalog.find((p) => String(p.id) === focusId) ??
      ({
        id: priorProducts[0].id,
        name: priorProducts[0].name,
        description: '',
        price: priorProducts[0].price,
        originalPrice: priorProducts[0].originalPrice,
        stock: priorProducts[0].stock ?? 0,
        category: priorProducts[0].category ?? '',
        imageUrl: priorProducts[0].imageUrl,
        sellerId: '',
        shopName: priorProducts[0].shopName,
        rating: priorProducts[0].rating ?? 0,
        soldCount: 0,
        createdAt: '',
      } as ChatContext['products'][number])
    ctxForReply = {
      ...enriched,
      enrichment: {
        ...enriched.enrichment,
        productId: focus.id,
        product: focus,
      },
    }
  }

  const intent = detected?.intent ?? null
  const hasPriceFilter = Boolean(extractPriceRange(userMessage))
  const forceLocal =
    Boolean(effectiveAttachments?.length) ||
    followUp ||
    hasPriceFilter ||
    (intent != null && FORCE_LOCAL_INTENTS.has(intent))

  if (!forceLocal && isLlmConfigured()) {
    try {
      const [content, local] = await Promise.all([
        callChatLlm(buildSystemPrompt(ctxForReply), history, userMessage).then(sanitizeChatReply),
        generateAssistantReply(userMessage, ctxForReply, effectiveAttachments),
      ])
      // Prefer local body when it already found catalog cards — avoids LLM inventing SKUs
      if (local.products?.length) {
        return {
          content: sanitizeChatReply(local.content),
          source: 'local',
          products: local.products,
        }
      }
      return {
        content,
        source: 'llm',
        products: local.products,
      }
    } catch {
      /* fallback local */
    }
  }

  const local = await generateAssistantReply(userMessage, ctxForReply, effectiveAttachments)
  return {
    content: sanitizeChatReply(local.content),
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
