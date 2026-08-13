import type { ChatContext } from '@/api/chat/context'
import { enrichChatContext, enrichFocusProduct } from '@/api/chat/enrich'
import { generateAssistantReply } from '@/api/chat/engine'
import {
  isContinuingProductChat,
  isProductFollowUp,
  lastDiscussedProducts,
  llmContradictsFacts,
  llmMissingCriticalFacts,
  looksLikeLowQualityReply,
  looksLikeOffTopicPlatformReply,
} from '@/api/chat/followup'
import { detectIntent, type ChatIntent } from '@/api/chat/intents'
import { callChatLlm, isLlmConfigured, llmProviderLabel, refreshBeAiStatus } from '@/api/chat/llm'
import {
  asksProductListedDate,
  asksProductOrigin,
  asksProductPrice,
  asksProductReview,
  asksSellerInfo,
  normalizeText,
} from '@/api/chat/match'
import { extractPriceRange, isPriceStatsQuery } from '@/api/chat/products'
import { sanitizeChatReply } from '@/api/chat/responses'
import { buildSystemPrompt } from '@/api/chat/systemPrompt'
import { buildVerifiedFacts } from '@/api/chat/verifiedFacts'
import { toChatProducts } from '@/api/chat/productCards'
import type { ChatMessage, ChatProductRef, ChatReviewSummary, ChatSellerRef, Product } from '@/types'

export type ChatReplySource = 'llm' | 'local'

export interface ChatReply {
  content: string
  source: ChatReplySource
  products?: ChatProductRef[]
  sellers?: ChatSellerRef[]
  reviewSummary?: ChatReviewSummary
}

/**
 * Chỉ ép local thuần cho số liệu tài chính / đơn / DSS — mọi thứ khác dùng hybrid:
 * local xác minh facts → LLM viết lại tự nhiên.
 */
const STRICT_LOCAL_INTENTS = new Set<ChatIntent>([
  'product_cheapest',
  'product_price',
  'product_stock',
  'product_review',
  'product_info',
  'contact_seller',
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
  if (asksProductReview(normalized)) {
    return { intent: 'product_review', score: 50 }
  }
  if (asksSellerInfo(normalized)) {
    return { intent: 'contact_seller', score: 50 }
  }
  if (asksProductOrigin(normalized) || asksProductListedDate(normalized)) {
    return { intent: 'product_info', score: 50 }
  }
  if (asksProductPrice(normalized)) {
    return { intent: 'product_price', score: 50 }
  }
  if (/con hang|het hang|ton|stock|available|con khong|con bao nhieu|con ban khong|het chua/.test(normalized)) {
    return { intent: 'product_stock', score: 50 }
  }
  if (/so sanh|compare|vs|khac nhau|nen mua cai nao|cai nao hon/.test(normalized)) {
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
  if (
    followUp &&
    (intent === 'product_price' ||
      intent === 'product_stock' ||
      intent === 'product_review' ||
      intent === 'product_info' ||
      intent === 'contact_seller' ||
      asksProductReview(normalized) ||
      asksSellerInfo(normalized) ||
      asksProductOrigin(normalized) ||
      asksProductListedDate(normalized) ||
      /^(gia|bao nhieu|con hang|het hang|con khong|may trieu)/.test(normalized))
  ) {
    return true
  }
  return false
}

function preferLocalOverLlm(
  normalized: string,
  llmContent: string,
  localContent: string,
  facts: ReturnType<typeof buildVerifiedFacts>,
): boolean {
  if (looksLikeOffTopicPlatformReply(normalized, llmContent)) return true
  if (looksLikeLowQualityReply(normalized, llmContent)) return true
  if (llmMissingCriticalFacts(normalized, llmContent, facts)) return true
  if (llmContradictsFacts(llmContent, facts)) return true

  const llmN = normalizeText(llmContent)
  const llmTooVague =
    llmContent.length < 35 ||
    /toi co the giup|ban muon hoi gi|hay cho minh biet|minh chua ro ban muon/.test(llmN)
  if (llmTooVague && localContent.trim().length > 35) return true

  return false
}

async function alignContextToFocus(
  ctx: ChatContext,
  focusRef: ChatProductRef,
  wantsReviews: boolean,
): Promise<ChatContext> {
  const focus = resolveFocusProduct(ctx, focusRef)
  const sameId =
    ctx.enrichment?.productId != null &&
    String(ctx.enrichment.productId) === String(focus.id)

  if (sameId && ctx.enrichment?.product) {
    return {
      ...ctx,
      enrichment: {
        ...ctx.enrichment,
        productId: focus.id,
        product: { ...ctx.enrichment.product, ...focus, name: focus.name, price: focus.price },
      },
    }
  }

  const fresh = await enrichFocusProduct(focus, { reviews: wantsReviews, detail: true })
  const mergedProduct: Product = {
    ...(fresh.product ?? focus),
    id: focus.id,
    name: focus.name,
    price: focus.price,
    imageUrl: focus.imageUrl || fresh.product?.imageUrl || '',
    category: focus.category || fresh.product?.category || '',
    shopName: focus.shopName || fresh.product?.shopName,
    rating: fresh.product?.rating ?? focus.rating ?? 0,
    soldCount: fresh.product?.soldCount ?? focus.soldCount ?? 0,
    stock: fresh.product?.stock ?? focus.stock ?? 0,
  }
  return {
    ...ctx,
    enrichment: {
      ...ctx.enrichment,
      productId: focus.id,
      product: mergedProduct,
      ratingSummary: fresh.ratingSummary,
      reviews: fresh.reviews,
    },
  }
}

/** Hybrid: local facts trước → LLM diễn đạt; fallback local nếu LLM lệch facts. */
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
  if (attachments?.length && asksProductReview(normalized)) {
    detected = { intent: 'product_review', score: 50 }
  } else if (followUp) {
    detected = resolveFollowUpIntent(normalized, detected)
  }

  const focusRef = effectiveAttachments?.[0] ?? (!attachments?.length ? priorProducts[0] : undefined)
  const wantsReviews =
    asksProductReview(normalized) || detected?.intent === 'product_review'

  const enriched = await enrichChatContext(
    ctx,
    userMessage,
    detected?.intent ?? null,
    focusRef?.id,
  )

  let ctxForReply = enriched
  if (focusRef) {
    ctxForReply = await alignContextToFocus(enriched, focusRef, wantsReviews)
  }

  const intent = detected?.intent ?? null
  const intentScore = detected?.score ?? 0
  const hasPriceFilter = Boolean(extractPriceRange(userMessage))
  const priceStats = isPriceStatsQuery(userMessage)
  const forceLocal = shouldForceLocal(normalized, intent, followUp, hasPriceFilter, priceStats)

  const local = await generateAssistantReply(userMessage, ctxForReply, effectiveAttachments)
  const facts = buildVerifiedFacts(ctxForReply, intent, intentScore, local)
  let products = local.products?.length
    ? local.products
    : facts.products.length
      ? facts.products
      : effectiveAttachments?.slice(0, 2)
  const sellers = local.sellers?.length ? local.sellers : undefined
  const reviewSummary = local.reviewSummary

  if (focusRef && wantsReviews) {
    const focusProduct = resolveFocusProduct(ctxForReply, focusRef)
    products = toChatProducts([focusProduct], 1)
  }

  const replyPayload = {
    content: sanitizeChatReply(local.content),
    source: 'local' as const,
    products,
    sellers,
    reviewSummary,
  }

  if (forceLocal) {
    return replyPayload
  }

  if (isLlmConfigured()) {
    try {
      const systemPrompt = buildSystemPrompt(ctxForReply, intent, facts)
      const llmRaw = await callChatLlm(systemPrompt, history, userMessage, facts)
      const content = sanitizeChatReply(llmRaw)

      if (preferLocalOverLlm(normalized, content, local.content, facts)) {
        return replyPayload
      }

      return { content, source: 'llm', products, sellers, reviewSummary }
    } catch {
      /* fallback local */
    }
  }

  return replyPayload
}

export function chatModeLabel(): string {
  return isLlmConfigured()
    ? `AI (${llmProviderLabel()}) + dữ liệu shop`
    : 'Trợ lý thông minh (local)'
}

export { refreshBeAiStatus }
