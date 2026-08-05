import type { ChatContext } from '@/api/chat/context'
import { enrichChatContext } from '@/api/chat/enrich'
import { generateAssistantReply } from '@/api/chat/engine'
import {
  isContinuingProductChat,
  isProductFollowUp,
  lastDiscussedProducts,
  looksLikeOffTopicPlatformReply,
} from '@/api/chat/followup'
import { detectIntent, type ChatIntent } from '@/api/chat/intents'
import { callChatLlm, isLlmConfigured, llmProviderLabel, refreshBeAiStatus } from '@/api/chat/llm'
import { normalizeText } from '@/api/chat/match'
import { extractPriceRange, isPriceStatsQuery } from '@/api/chat/products'
import { sanitizeChatReply } from '@/api/chat/responses'
import { buildSystemPrompt } from '@/api/chat/systemPrompt'
import type { ChatMessage, ChatProductRef, Product } from '@/types'

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
  'product_review',
  'recommend',
  'where_to_buy',
  'contact_seller',
  'orders',
  'order_detail',
  'order_cancel',
  'cart',
  'cart_summary',
  'shop_overview',
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
  if (/review|danh gia|sao|tot khong|ngon khong|chat luong/.test(normalized)) {
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

function resolveFocusProduct(
  enriched: ChatContext,
  prior: ChatProductRef,
): Product {
  const catalog =
    enriched.role === 'seller' && enriched.sellerProducts.length
      ? enriched.sellerProducts
      : enriched.products
  const found = catalog.find((p) => String(p.id) === String(prior.id))
  if (found) return found
  return {
    id: prior.id,
    name: prior.name,
    description: '',
    price: prior.price,
    originalPrice: prior.originalPrice,
    stock: prior.stock ?? 0,
    category: prior.category ?? '',
    imageUrl: prior.imageUrl,
    sellerId: '',
    shopName: prior.shopName,
    rating: prior.rating ?? 0,
    soldCount: 0,
    createdAt: '',
  }
}

/** Local engine cho catalog/DSS; API AI cho hội thoại — luôn giữ SP đang bàn. */
export async function resolveChatReply(
  userMessage: string,
  history: ChatMessage[],
  ctx: ChatContext,
  attachments?: ChatProductRef[],
): Promise<ChatReply> {
  const normalized = normalizeText(userMessage)
  const priorProducts = lastDiscussedProducts(history)
  const followUp =
    !attachments?.length &&
    priorProducts.length > 0 &&
    (isProductFollowUp(normalized) || isContinuingProductChat(normalized, true))
  const effectiveAttachments =
    attachments?.length ? attachments : followUp ? priorProducts.slice(0, 2) : undefined

  let detected = detectIntent(userMessage, ctx.role)
  if (followUp) {
    detected = resolveFollowUpIntent(normalized, detected)
  }

  const enriched = await enrichChatContext(ctx, userMessage, detected?.intent ?? null)

  let ctxForReply = enriched
  // Luôn gắn SP gần nhất vào context khi còn đang nói về SP / có đính kèm
  const focusRef = effectiveAttachments?.[0] ?? (!attachments?.length ? priorProducts[0] : undefined)
  if (focusRef && !enriched.enrichment?.product) {
    const focus = resolveFocusProduct(enriched, focusRef)
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
  const priceStats = isPriceStatsQuery(userMessage)
  const forceLocal =
    Boolean(effectiveAttachments?.length) ||
    followUp ||
    hasPriceFilter ||
    priceStats ||
    (intent != null && FORCE_LOCAL_INTENTS.has(intent))

  const runLocal = () => generateAssistantReply(userMessage, ctxForReply, effectiveAttachments)

  // Catalog / follow-up SP: local engine (đúng số liệu, không quên SP)
  if (forceLocal) {
    const local = await runLocal()
    return {
      content: sanitizeChatReply(local.content),
      source: 'local',
      products: local.products?.length ? local.products : effectiveAttachments?.slice(0, 2),
    }
  }

  // Hội thoại tự do: ưu tiên backend AI API + history đầy đủ
  if (isLlmConfigured()) {
    try {
      const [llmRaw, local] = await Promise.all([
        callChatLlm(buildSystemPrompt(ctxForReply), history, userMessage),
        runLocal(),
      ])
      const content = sanitizeChatReply(llmRaw)

      if (looksLikeOffTopicPlatformReply(normalized, content)) {
        return {
          content: sanitizeChatReply(local.content),
          source: 'local',
          products: local.products,
        }
      }

      // Local đã có card SP → giữ card, ưu tiên câu local nếu LLM quá chung chung
      if (local.products?.length) {
        const llmTooVague = content.length < 40 || /toi co the giup|ban muon hoi gi/.test(normalizeText(content))
        return {
          content: llmTooVague ? sanitizeChatReply(local.content) : content,
          source: llmTooVague ? 'local' : 'llm',
          products: local.products,
        }
      }

      return { content, source: 'llm', products: local.products }
    } catch {
      /* fallback local */
    }
  }

  const local = await runLocal()
  return {
    content: sanitizeChatReply(local.content),
    source: 'local',
    products: local.products,
  }
}

export function chatModeLabel(): string {
  return isLlmConfigured()
    ? `AI API (${llmProviderLabel()}) + dữ liệu shop`
    : 'Trợ lý thông minh (local)'
}

export { refreshBeAiStatus }
