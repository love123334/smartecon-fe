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
  looksLikePromptLeak,
  looksLikeSafetyMetadataLeak,
} from '@/api/chat/followup'
import { isStandaloneShoppingQuery } from '@/api/chat/discovery'
import { detectIntent, isVoucherQuery, type ChatIntent } from '@/api/chat/intents'
import { callChatLlm, isLlmConfigured, llmProviderLabel, refreshBeAiStatus } from '@/api/chat/llm'
import {
  asksProductListedDate,
  asksProductOrigin,
  asksProductPrice,
  asksProductReview,
  asksSellerInfo,
  normalizeText,
} from '@/api/chat/match'
import { constrainProductsToQueryBudget, extractPriceRange, isPriceStatsQuery } from '@/api/chat/products'
import { sanitizeChatReply, softenLocalFallback } from '@/api/chat/responses'
import { deriveSuggestedActions } from '@/api/chat/suggestedActions'
import {
  intentAllowedForRole,
  outOfScopeReply,
  resolveIntentForRole,
} from '@/api/chat/rolePolicy'
import { buildProcessingLocale } from '@/api/chat/chatLocale'
import { buildChatMemoryLayers } from '@/api/chat/conversationMemory'
import { executeChatTools } from '@/api/chat/toolExecutor'
import { routeFromIntent } from '@/api/chat/intentRouter'
import { buildSlimSystemPrompt } from '@/api/chat/slimPrompt'
import { buildSystemPrompt } from '@/api/chat/systemPrompt'
import { buildVerifiedFacts } from '@/api/chat/verifiedFacts'
import { parseExplicitCalendarMonth } from '@/api/chat/sellerAnalytics'
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

export interface ChatLocalDraft {
  content: string
  products?: ChatProductRef[]
  sellers?: ChatSellerRef[]
  reviewSummary?: ChatReviewSummary
  suggestedActions?: ChatSuggestedAction[]
}

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
 * Ép local chỉ khi cần số liệu sổ sách / DSS cứng.
 * Browse / budget / search / recommend → local lọc SP + LLM viết thoại tự nhiên.
 */
const STRICT_LOCAL_INTENTS = new Set<ChatIntent>([
  'greeting',
  'thanks',
  'order_cancel',
  'cart_summary',
  'promo',
  'seller_revenue',
  'seller_profit',
  'seller_business_health',
  'seller_dss_explain',
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
  _normalized: string,
  intent: ChatIntent | null,
  _followUp: boolean,
  _hasPriceFilter: boolean,
  priceStats: boolean,
  backendAiReady: boolean,
): boolean {
  if (!backendAiReady) return true
  if (priceStats) return true
  if (intent != null && STRICT_LOCAL_INTENTS.has(intent)) return true
  return false
}

function enrichShortShoppingReply(llm: string, localContent: string, hasProducts: boolean): string {
  if (!hasProducts) return llm
  const bullets = localContent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('•'))
  if (bullets.length < 2) return llm
  const alreadyExplains =
    llm.length >= 220 &&
    (/[•\-]/.test(llm) || /đánh giá|đã bán|vì |bởi |ngân sách|★/.test(llm))
  if (alreadyExplains) return llm
  return `${llm}\n\n${bullets.join('\n')}`
}

function backendReplyLooksGrounded(content: string): boolean {
  const c = content.toLowerCase()
  return (
    /\d[\d.,]*\s*(?:đ|vnd|vnđ|triệu|tr)/i.test(content) ||
    /(?:còn|tồn|kho|giá bán|shop| cửa hàng)/i.test(c) ||
    /(?:sản phẩm|tai nghe|laptop|iphone|macbook)/i.test(c)
  )
}

function llmDeniesProductsWhileLocalHasHits(
  llmContent: string,
  localProducts: ChatProductRef[] | undefined,
): boolean {
  if (!localProducts?.length) return false
  const n = normalizeText(llmContent)
  return (
    /khong co (san pham|sp|mat hang)|chua (tim|co) (duoc )?(san pham|sp)|khong tim thay|khong thay (san pham|sp)|theo thong tin hien tai/.test(
      n,
    ) && /khong|chua|het/.test(n)
  )
}

function llmLeaksPlatformScope(llmContent: string): boolean {
  const n = normalizeText(llmContent)
  return /toan san|toan nen tang|gmv (san|toan)|tat ca (shop|nguoi ban)|marketplace total|doanh thu san(?! pham)/.test(
    n,
  )
}

function llmWrongAskedMonth(userMessage: string, llmContent: string): boolean {
  const asked = parseExplicitCalendarMonth(userMessage)
  if (!asked) return false
  const n = normalizeText(llmContent)
  const mentioned = [...n.matchAll(/thang\s*(1[0-2]|0?[1-9])(?!\d)/g)].map((m) => Number(m[1]))
  if (!mentioned.length) return false
  return mentioned.every((m) => m !== asked.month)
}

function preferLocalOverLlm(
  normalized: string,
  llmContent: string,
  localContent: string,
  facts: ReturnType<typeof buildVerifiedFacts>,
  backendGrounded = false,
  localProducts?: ChatProductRef[],
  role?: string,
  userMessage?: string,
): ChatFallbackReason | null {
  if (looksLikeSafetyMetadataLeak(llmContent) || looksLikePromptLeak(llmContent)) {
    return 'low_quality'
  }
  if (llmDeniesProductsWhileLocalHasHits(llmContent, localProducts)) {
    return 'contradicts_facts'
  }
  if (role === 'seller' && llmLeaksPlatformScope(llmContent) && localContent.trim().length > 20) {
    return 'contradicts_facts'
  }
  if (role === 'seller' && userMessage && llmWrongAskedMonth(userMessage, llmContent) && localContent.trim().length > 20) {
    return 'contradicts_facts'
  }
  // Backend Gemini + tools already grounded — keep its wording unless clearly off-topic / price clash
  if (backendGrounded) {
    if (looksLikeOffTopicPlatformReply(normalized, llmContent)) return 'off_topic'
    if (llmContradictsFacts(llmContent, facts)) return 'contradicts_facts'
    return null
  }
  if (looksLikeOffTopicPlatformReply(normalized, llmContent)) return 'off_topic'
  if (looksLikeLowQualityReply(normalized, llmContent)) return 'low_quality'
  if (llmMissingCriticalFacts(normalized, llmContent, facts)) {
    return 'missing_facts'
  }
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

function isOrderFollowUp(normalized: string, prior?: ConversationContext): boolean {
  if (!prior || prior.activeTask !== 'order') return false
  return /don|order|giao|ship|trang thai|hom nay|hom qua|gan day|cuoi cung|da giao|dang giao|chi tiet|mua gi/.test(
    normalized,
  )
}

function isSellerAnalyticsFollowUp(normalized: string, prior?: ConversationContext): boolean {
  if (!prior || prior.activeTask !== 'seller_ops') return false
  return /doanh thu|loi nhuan|profit|don|ton kho|nhap|dss|shop|thang nay|tai sao|tang|giam|ban chay|what if|gia|nhu cau|demand|du bao|tuong lai|forecast/.test(
    normalized,
  )
}

/** Hybrid: local facts trước → LLM diễn đạt; fallback/sửa facts nếu LLM lệch. */
export async function resolveChatReply(
  userMessage: string,
  history: ChatMessage[],
  ctx: ChatContext,
  attachments?: ChatProductRef[],
  priorConversation?: ConversationContext,
  onLocalDraft?: (draft: ChatLocalDraft) => void,
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
  } else if (isOrderFollowUp(normalized, priorConversation)) {
    detected = { intent: 'orders', score: 48 }
  } else if (isSellerAnalyticsFollowUp(normalized, priorConversation)) {
    const priorMetric = priorConversation?.sellerAnalyticsSpec?.metric
    if (priorMetric === 'health' || /shop|kinh doanh|suc khoe/.test(normalized)) {
      detected = { intent: 'seller_business_health', score: 48 }
    } else if (/nhu cau|demand|du bao|forecast|tuong lai/.test(normalized)) {
      detected = { intent: 'seller_dss_demand', score: 48 }
    } else if (/loi nhuan|profit|margin|von/.test(normalized)) {
      detected = { intent: 'seller_profit', score: 48 }
    } else if (/tai sao|vi sao|tang|giam|so voi/.test(normalized)) {
      detected = { intent: 'seller_revenue', score: 48 }
    } else if (/nhap|restock|ton kho/.test(normalized)) {
      detected = { intent: 'seller_inventory', score: 48 }
    } else {
      detected = { intent: 'seller_revenue', score: 45 }
    }
  }

  const rawIntent = detected?.intent ?? null
  const blockedIntent =
    rawIntent && !intentAllowedForRole(rawIntent, ctx.role) ? rawIntent : null
  let intent = blockedIntent ? null : resolveIntentForRole(rawIntent, ctx.role, userMessage)
  let intentScore = detected?.score ?? 0
  if (intent !== rawIntent && intent) {
    intentScore = Math.max(intentScore, 45)
  }

  const focusRef =
    effectiveAttachments?.[0] ??
    (followUp && !attachments?.length ? priorProducts[0] : undefined)
  const wantsReviews =
    asksProductReview(normalized) || detected?.intent === 'product_review'

  const enriched = await enrichChatContext(
    ctx,
    userMessage,
    intent,
    focusRef?.id,
  )

  let ctxForReply = enriched
  if (focusRef) {
    ctxForReply = await alignContextToFocus(enriched, focusRef, wantsReviews)
  }
  if (priorConversation?.orderQuerySpec) {
    ctxForReply = {
      ...ctxForReply,
      enrichment: {
        ...ctxForReply.enrichment,
        orderQueryPrior: priorConversation.orderQuerySpec,
      },
    }
  }
  if (priorConversation?.sellerAnalyticsSpec) {
    ctxForReply = {
      ...ctxForReply,
      enrichment: {
        ...ctxForReply.enrichment,
        sellerAnalyticsPrior: priorConversation.sellerAnalyticsSpec,
      },
    }
  }

  const hasPriceFilter = Boolean(extractPriceRange(userMessage))
  const priceStats = isPriceStatsQuery(userMessage)
  const backendAiReady = isLlmConfigured()
  const forceLocal = shouldForceLocal(
    normalized,
    intent,
    followUp,
    hasPriceFilter,
    priceStats,
    backendAiReady,
  )

  const localStarted = performance.now()
  const rawLocal = await generateAssistantReply(userMessage, ctxForReply, effectiveAttachments, intent)
  localLatencyMs = Math.round(performance.now() - localStarted)
  const rangedLocalProducts =
    hasPriceFilter && rawLocal.products?.length
      ? constrainProductsToQueryBudget(rawLocal.products, userMessage)
      : rawLocal.products
  const local = { ...rawLocal, products: rangedLocalProducts }

  const facts = buildVerifiedFacts(ctxForReply, intent, intentScore, local, userMessage)
  let products = local.products?.length
    ? local.products
    : facts.products.length
      ? facts.products
      : effectiveAttachments?.slice(0, 2)
  if (intent === 'promo' || isVoucherQuery(userMessage)) {
    products = undefined
  }
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
      categories: ctxForReply.categories,
    },
  )

  const suggestedActions: ChatSuggestedAction[] = deriveSuggestedActions(
    intent,
    Boolean(products?.length || focusRef),
    ctxForReply.role,
  )

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
    const display =
      source === 'local' && fallbackReason !== 'force_local'
        ? softenLocalFallback(content, Boolean(products?.length))
        : sanitizeChatReply(content)
    return {
      content: display,
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

  if (blockedIntent) {
    return replyPayload('local', outOfScopeReply(ctxForReply, blockedIntent), 'force_local')
  }

  if (forceLocal) {
    return replyPayload('local', localContent, 'force_local')
  }

  if (isLlmConfigured()) {
    if (localContent.trim().length >= 40 || products?.length) {
      onLocalDraft?.({
        content: localContent,
        products,
        sellers,
        reviewSummary,
        suggestedActions,
      })
    }
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
          userRole: ctx.role,
        },
      )
      llmLatencyMs = Math.round(performance.now() - llmStarted)
      const content = sanitizeChatReply(llmRaw)

      if (looksLikePromptLeak(content) || looksLikeSafetyMetadataLeak(content)) {
        return replyPayload('local', localContent, 'low_quality', true)
      }

      if (
        hasPriceFilter &&
        products?.length &&
        !products.some((p) => content.toLowerCase().includes(p.name.toLowerCase().slice(0, 16)))
      ) {
        return replyPayload('local', localContent, 'contradicts_facts', true)
      }

      const backendGrounded = backendReplyLooksGrounded(content)
      const fallbackReason = preferLocalOverLlm(
        normalized,
        content,
        localContent,
        facts,
        backendGrounded,
        products,
        ctx.role,
        userMessage,
      )
      if (fallbackReason === 'contradicts_facts') {
        const repaired = repairPriceFactsInReply(content, facts)
        if (repaired && !llmContradictsFacts(repaired, facts) && !looksLikePromptLeak(repaired)) {
          return replyPayload('llm_repaired', repaired, undefined, true)
        }
      }

      if (fallbackReason) {
        return replyPayload('local', localContent, fallbackReason, true)
      }

      return replyPayload(
        'llm',
        enrichShortShoppingReply(content, localContent, Boolean(products?.length)),
        undefined,
        true,
      )
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : ''
      // If Gemini is down, keep local facts but mark clearly in telemetry
      if (/Gemini|BE AI|502|Bad Gateway|chưa cấu hình/i.test(errMsg) && localContent.trim()) {
        return replyPayload('local', localContent, 'llm_error', true)
      }
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
