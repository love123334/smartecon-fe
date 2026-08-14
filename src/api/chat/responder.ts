import type { ChatContext } from '@/api/chat/context'
import { enrichChatContext, enrichFocusProduct } from '@/api/chat/enrich'
import { generateAssistantReply } from '@/api/chat/engine'
import {
  buildConversationContext,
  updateConversationContext,
  type ConversationContext,
} from '@/api/chat/conversationContext'
import {
  createChatTelemetry,
  logChatTurn,
  type ChatFallbackReason,
  type ChatFinalSource,
  type ChatTurnTelemetry,
} from '@/api/chat/chatTelemetry'
import { repairPriceFactsInReply } from '@/api/chat/factRepair'
import {
  isBrowseOrSearchIntent,
  isContinuingProductChat,
  isProductFollowUp,
  lastDiscussedProducts,
  llmContradictsFacts,
  llmMissingCriticalFacts,
  looksLikeLowQualityReply,
  looksLikeOffTopicPlatformReply,
} from '@/api/chat/followup'
import { isStandaloneShoppingQuery } from '@/api/chat/discovery'
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
import { deriveSuggestedActions } from '@/api/chat/suggestedActions'
import { buildProcessingLocale, englishGlossForPrompt } from '@/api/chat/chatLocale'
import { buildChatMemoryLayers } from '@/api/chat/conversationMemory'
import { executeChatTools } from '@/api/chat/chatTools'
import { routeFromIntent } from '@/api/chat/intentRouter'
import { buildSlimSystemPrompt } from '@/api/chat/slimPrompt'
import { buildSystemPrompt } from '@/api/chat/systemPrompt'
import { buildVerifiedFacts } from '@/api/chat/verifiedFacts'
import { toChatProducts } from '@/api/chat/productCards'
import type {
  ChatMessage,
  ChatProductRef,
  ChatReviewSummary,
  ChatSellerRef,
  ChatSuggestedAction,
  Product,
} from '@/types'

export type ChatReplySource = ChatFinalSource

export interface ChatReply {
  content: string
  source: ChatReplySource
  products?: ChatProductRef[]
  sellers?: ChatSellerRef[]
  reviewSummary?: ChatReviewSummary
  suggestedActions?: ChatSuggestedAction[]
  conversationContext: ConversationContext
  telemetry: ChatTurnTelemetry
}

/**
 * Ép local thuần cho số liệu tài chính / đơn / DSS — mô tả SP & review dùng hybrid.
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
): ChatFallbackReason | null {
  if (looksLikeOffTopicPlatformReply(normalized, llmContent)) return 'off_topic'
  if (looksLikeLowQualityReply(normalized, llmContent)) return 'low_quality'
  if (llmMissingCriticalFacts(normalized, llmContent, facts)) return 'missing_facts'
  if (llmContradictsFacts(llmContent, facts)) return 'contradicts_facts'

  const llmN = normalizeText(llmContent)
  const llmTooVague =
    llmContent.length < 35 ||
    /toi co the giup|ban muon hoi gi|hay cho minh biet|minh chua ro ban muon/.test(llmN)
  if (llmTooVague && localContent.trim().length > 35) return 'too_vague'

  return null
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

/** Hybrid: local facts trước → LLM diễn đạt; fallback/sửa facts nếu LLM lệch. */
export async function resolveChatReply(
  userMessage: string,
  history: ChatMessage[],
  ctx: ChatContext,
  attachments?: ChatProductRef[],
  priorConversation?: ConversationContext,
): Promise<ChatReply> {
  const started = performance.now()
  let localLatencyMs = 0
  let llmLatencyMs: number | undefined

  const locale = buildProcessingLocale(userMessage)
  const normalized = locale.normalized
  const priorProducts = lastDiscussedProducts(history)

  let detected = detectIntent(userMessage, ctx.role)
  const standaloneBrowse =
    isStandaloneShoppingQuery(normalized) || isBrowseOrSearchIntent(detected?.intent ?? null)
  const followUp =
    !attachments?.length &&
    priorProducts.length > 0 &&
    !standaloneBrowse &&
    (isProductFollowUp(normalized) || isContinuingProductChat(normalized, true))
  const effectiveAttachments =
    attachments?.length ? attachments : followUp ? priorProducts.slice(0, 2) : undefined
  if (attachments?.length && asksProductReview(normalized)) {
    detected = { intent: 'product_review', score: 50 }
  } else if (followUp) {
    detected = resolveFollowUpIntent(normalized, detected)
  }

  const focusRef =
    effectiveAttachments?.[0] ??
    (followUp && !attachments?.length ? priorProducts[0] : undefined)
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

  const localStarted = performance.now()
  const local = await generateAssistantReply(userMessage, ctxForReply, effectiveAttachments)
  localLatencyMs = Math.round(performance.now() - localStarted)

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

  const conversationContext = updateConversationContext(
    priorConversation ?? buildConversationContext(history, attachments),
    {
      userMessage,
      intent,
      products,
      attachments: effectiveAttachments,
    },
  )

  const hasProductFocus = Boolean(
    conversationContext.currentProduct || conversationContext.lastResults.length,
  )
  const suggestedActions = deriveSuggestedActions(intent, hasProductFocus, ctx.role)

  const replyPayload = (
    source: ChatFinalSource,
    content: string,
    fallbackReason?: ChatFallbackReason,
    llmCalled = false,
  ): ChatReply => {
    const telemetry = createChatTelemetry({
      intent,
      intentScore,
      llmCalled,
      llmProvider: llmCalled ? llmProviderLabel() : undefined,
      localLatencyMs,
      llmLatencyMs,
      latencyMs: Math.round(performance.now() - started),
      finalSource: source,
      fallbackReason,
      followUp,
      hasAttachments: Boolean(attachments?.length),
      activeTask: conversationContext.activeTask,
    })
    logChatTurn(telemetry)
    return {
      content: sanitizeChatReply(content),
      source,
      products,
      sellers,
      reviewSummary,
      suggestedActions,
      conversationContext,
      telemetry,
    }
  }

  const localContent = sanitizeChatReply(local.content)

  if (forceLocal) {
    return replyPayload('local', localContent, 'force_local')
  }

  if (isLlmConfigured()) {
    try {
      const llmStarted = performance.now()
      const route = routeFromIntent(intent)
      const memory = buildChatMemoryLayers(
        history,
        conversationContext,
        intent,
        ctx.role,
        route,
        ctx.userName,
      )
      const toolResults = executeChatTools(ctx.role, route, ctxForReply)
      const useSlimOrchestration = route !== 'GENERAL_CHAT' && route !== 'UNKNOWN'
      const systemPrompt = useSlimOrchestration
        ? buildSlimSystemPrompt(ctxForReply, route, memory, toolResults, facts)
        : buildSystemPrompt(ctxForReply, intent, facts)
      const llmRaw = await callChatLlm(
        systemPrompt,
        history,
        userMessage,
        facts,
        {
          recentTurns: memory.recentTurns,
          englishGloss: englishGlossForPrompt(locale),
        },
      )
      llmLatencyMs = Math.round(performance.now() - llmStarted)
      const content = sanitizeChatReply(llmRaw)

      const fallbackReason = preferLocalOverLlm(normalized, content, localContent, facts)
      if (fallbackReason === 'contradicts_facts') {
        const repaired = repairPriceFactsInReply(content, facts)
        if (repaired && !llmContradictsFacts(repaired, facts)) {
          return replyPayload('llm_repaired', repaired, undefined, true)
        }
      }

      if (fallbackReason) {
        return replyPayload('local', localContent, fallbackReason, true)
      }

      return replyPayload('llm', content, undefined, true)
    } catch {
      return replyPayload('local', localContent, 'llm_error', true)
    }
  }

  return replyPayload('local', localContent, 'not_configured')
}

export function chatModeLabel(): string {
  return isLlmConfigured()
    ? `AI (${llmProviderLabel()}) + dữ liệu shop`
    : 'Trợ lý thông minh (local)'
}

export { refreshBeAiStatus }
