import type { ChatContext } from '@/api/chat/context'
import { enrichChatContext } from '@/api/chat/enrich'
import { generateAssistantReply } from '@/api/chat/engine'
import {
  isContinuingProductChat,
  isProductFollowUp,
  lastDiscussedProducts,
  looksLikeLowQualityReply,
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

/**
 * Chỉ ép local cho số liệu / đơn / DSS — tránh template cứng khi tìm SP, gợi ý, mô tả.
 * Search/recommend/info → LLM (nếu có) + card SP từ local.
 */
const STRICT_LOCAL_INTENTS = new Set<ChatIntent>([
  'product_cheapest',
  'product_price',
  'product_stock',
  'orders',
  'order_detail',
  'order_cancel',
  'cart',
  'cart_summary',
  'seller_dss_demand',
  'seller_dss_price',
  'seller_dss_inventory',
  'seller_whatif',
  'seller_pricing',
  'seller_revenue',
  'seller_orders',
  'seller_recent_orders',
  'seller_purchase_orders',
  'seller_inventory',
  'seller_top_products',
  'manager_kpi',
  'manager_pending',
  'manager_revenue',
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

function resolveFocusProduct(enriched: ChatContext, prior: ChatProductRef): Product {
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

function shouldForceLocal(
  normalized: string,
  intent: ChatIntent | null,
  followUp: boolean,
  hasPriceFilter: boolean,
  priceStats: boolean,
): boolean {
  if (priceStats || hasPriceFilter) return true
  if (intent != null && STRICT_LOCAL_INTENTS.has(intent)) return true
  // Follow-up giá/tồn → số liệu local; còn lại để LLM nói tự nhiên với SP focus
  if (
    followUp &&
    (intent === 'product_price' ||
      intent === 'product_stock' ||
      /^(gia|bao nhieu|con hang|het hang|con khong)/.test(normalized))
  ) {
    return true
  }
  return false
}

function preferLocalOverLlm(
  normalized: string,
  llmContent: string,
  localContent: string,
  localHasProducts: boolean,
): boolean {
  if (looksLikeOffTopicPlatformReply(normalized, llmContent)) return true
  if (looksLikeLowQualityReply(normalized, llmContent)) return true
  const llmN = normalizeText(llmContent)
  const llmTooVague =
    llmContent.length < 40 || /toi co the giup|ban muon hoi gi|hay cho minh biet/.test(llmN)
  if (llmTooVague && localContent.trim().length > 40) return true
  // Local có card rõ + LLM không nhắc giá/tên SP cụ thể khi user hỏi mua
  if (
    localHasProducts &&
    /mua|tim|goi y|nen|duoi|gia|co ban/.test(normalized) &&
    !/\d/.test(llmContent) &&
    localContent.includes('**')
  ) {
    return false // vẫn dùng LLM nếu có card — card cứu ngữ cảnh; chỉ đổi khi quá tệ
  }
  return false
}

/** Local cho số liệu; LLM cho hội thoại — luôn giữ card SP khi có. */
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
  const forceLocal = shouldForceLocal(normalized, intent, followUp, hasPriceFilter, priceStats)

  const runLocal = () => generateAssistantReply(userMessage, ctxForReply, effectiveAttachments)

  if (forceLocal) {
    const local = await runLocal()
    return {
      content: sanitizeChatReply(local.content),
      source: 'local',
      products: local.products?.length ? local.products : effectiveAttachments?.slice(0, 2),
    }
  }

  // Song song: local lấy card/số liệu, LLM viết câu trả lời tự nhiên
  if (isLlmConfigured()) {
    try {
      const systemPrompt = buildSystemPrompt(ctxForReply, intent)
      const [llmRaw, local] = await Promise.all([
        callChatLlm(systemPrompt, history, userMessage),
        runLocal(),
      ])
      const content = sanitizeChatReply(llmRaw)
      const products = local.products?.length
        ? local.products
        : effectiveAttachments?.slice(0, 2)

      if (preferLocalOverLlm(normalized, content, local.content, Boolean(local.products?.length))) {
        return {
          content: sanitizeChatReply(local.content),
          source: 'local',
          products,
        }
      }

      return { content, source: 'llm', products }
    } catch {
      /* fallback local */
    }
  }

  const local = await runLocal()
  return {
    content: sanitizeChatReply(local.content),
    source: 'local',
    products: local.products?.length ? local.products : effectiveAttachments?.slice(0, 2),
  }
}

export function chatModeLabel(): string {
  return isLlmConfigured()
    ? `AI API (${llmProviderLabel()}) + dữ liệu shop`
    : 'Trợ lý thông minh (local)'
}

export { refreshBeAiStatus }
