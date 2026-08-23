import type { ChatContext } from '@/api/chat/context'
import { detectIntent, type ChatIntent } from '@/api/chat/intents'
import { formatVnd, normalizeText, normalizeChatTypos, asksProductListedDate, asksProductOrigin, asksProductPrice, asksProductReview, asksSellerInfo } from '@/api/chat/match'
import { toChatProducts } from '@/api/chat/productCards'
import { resolveReplySellers, sellerCardFromProduct, toChatSellers } from '@/api/chat/sellerCards'
import {
  asksProductDiscovery,
  discoveryReplyIntro,
  isAmbiguousShoppingQuery,
  isDiscoveryNewestQuery,
  isUnknownEscalateText,
} from '@/api/chat/discovery'
import { buildProcessingLocale, isShopCatalogQuestion } from '@/api/chat/chatLocale'
import { matchCategoryFromText, stripCategoryBrowseQuery } from '@/api/chat/synonyms'
import { catalogInsightHighlights } from '@/api/chat/insightEngine'
import {
  cheapestProducts,
  affordableProductsForQuery,
  computeProductPriceStats,
  extractAffordableSearchTerms,
  extractBudgetVnd,
  extractPriceRange,
  extractProductFocusLabel,
  extractSellerNameQuery,
  filterProductsForQuery,
  filterProductsByCategory,
  findProductsByQuery,
  findProductsBySellerName,
  formatPriceRangeLabel,
  groupProductsByShop,
  isAffordableProductQuery,
  isPriceStatsQuery,
  newestProducts,
  pickProductCatalog,
  productsUnderBudget,
  rankRecommendedProducts,
} from '@/api/chat/products'
import { presentProductSearchResult, searchProductsWithPolicy } from '@/api/chat/productMatch'
import {
  buildIntentReply,
  escalateReply,
  productListedReply,
  productOriginReply,
  productReviewReply,
  sanitizeChatReply,
  sellerShopSummaryReply,
} from '@/api/chat/responses'
import type { ChatProductRef, ChatReviewSummary, ChatSellerRef, Product } from '@/types'

export { formatVnd, normalizeText } from '@/api/chat/match'

export interface AssistantReplyPayload {
  content: string
  products?: ChatProductRef[]
  sellers?: ChatSellerRef[]
  reviewSummary?: ChatReviewSummary
}

const SHOPPING_INTENTS = new Set<ChatIntent>([
  'product_budget',
  'product_search',
  'product_cheapest',
  'category_browse',
  'promo',
  'compare',
  'product_info',
  'product_price',
  'product_stock',
  'product_review',
  'shop_overview',
  'categories',
])

const METADATA_INTENTS = new Set<ChatIntent>([
  'product_review',
  'product_info',
  'product_price',
  'product_stock',
  'contact_seller',
])

/** Intent không được “lạc” sang tìm sản phẩm */
const NON_SHOPPING_INTENTS = new Set<ChatIntent>([
  'orders',
  'order_detail',
  'order_cancel',
  'cart',
  'cart_summary',
  'shipping',
  'payment',
  'account',
  'password',
  'checkout',
  'complaint',
  'return_policy',
  'contact_escalate',
  'greeting',
  'thanks',
  'help',
  'platform',
  'seller_orders',
  'seller_recent_orders',
  'seller_purchase_orders',
  'seller_revenue',
  'seller_inventory',
  'seller_pricing',
  'seller_dss_demand',
  'seller_dss_price',
  'seller_dss_inventory',
  'seller_whatif',
  'seller_business_health',
  'seller_profit',
  'seller_dss_explain',
  'manager_kpi',
  'manager_pending',
  'manager_revenue',
])

function greet(name: string): string {
  const n = name?.trim()
  if (!n || n.length < 2) return ''
  // Bỏ tên demo / generic cho tự nhiên hơn
  if (/nguyen van khach|khach hang|guest|user\d+/i.test(n)) return ''
  if (/^[a-z0-9._-]+$/i.test(n) && !/\s/.test(n) && n.length < 24) return ''
  const first = n.split(/\s+/).pop() || n
  if (first.length < 2) return ''
  return `${first}, `
}

function isOffTopic(normalized: string): boolean {
  return /thoi tiet|chinh tri|bong da|lap trinh|python|javascript|chatgpt|tinh yeu|lam bai|toan hoc|dich thuat|ke chuyen|hat nhac|phim bo|crypto|chung khoan|bitcoin/.test(
    normalized,
  )
}

function stockPhrase(stock: number | undefined | null): string {
  if (stock == null || Number.isNaN(Number(stock))) return 'tồn chưa rõ'
  if (stock <= 0) return 'hết hàng'
  return `còn ${stock}`
}

function sellerHintFromProducts(products: Product[]): string {
  const groups = groupProductsByShop(products, 3, 1)
  if (!groups.length) return ''
  return `\nShop đang bán: ${groups.map((g) => g.shop).join(', ')}.`
}

function wrapReply(
  payload: AssistantReplyPayload,
  ctx?: ChatContext,
  raw?: string,
): AssistantReplyPayload {
  let content = payload.content
  if (payload.products?.length && isUnknownEscalateText(content) && ctx) {
    const lower = normalizeText(raw ?? '')
    content = discoveryReplyIntro(
      ctx.userName,
      payload.products.length,
      isDiscoveryNewestQuery(lower) ? 'newest' : 'recommend',
      payload.products[0]?.name,
    )
  }
  return { ...payload, content: sanitizeChatReply(content) }
}

function resolveAttachmentFollowUpIntent(lower: string): ChatIntent | null {
  const n = normalizeChatTypos(lower)
  if (asksProductReview(n)) return 'product_review'
  if (asksSellerInfo(n)) return 'contact_seller'
  if (asksProductOrigin(n) || asksProductListedDate(n)) return 'product_info'
  if (asksProductPrice(n)) return 'product_price'
  if (/con hang|het hang|ton|stock/.test(n)) return 'product_stock'
  return null
}
function followUps(intent: ChatIntent | null, role: ChatContext['role']): string {
  // Không gắn tip cứng — để Gemini/local tự nhiên như setup teammate
  if (
    role === 'guest' &&
    intent &&
    ['cart', 'cart_summary', 'orders', 'order_detail', 'checkout'].includes(intent)
  ) {
    return '\n\nĐăng nhập để xem giỏ và đơn cá nhân nhé.'
  }
  return ''
}

type IntroMode = 'search' | 'shop' | 'budget' | 'cheapest' | 'affordable'

/** Local fallback copy — conversational; UI cards carry the catalog. */
function warmProductIntro(
  ctx: ChatContext,
  count: number,
  topic?: string,
  mode: IntroMode = 'search',
  topPick?: string,
): string {
  const name = greet(ctx.userName ?? '')
  if (count <= 0) {
    return topic
      ? `${name}Trong tầm **${topic}** mình chưa thấy mẫu khớp hoàn toàn. Bạn muốn nới budget một chút hay giữ mức này và bỏ bớt điều kiện?`
      : `${name}Mình chưa thấy mẫu nào khớp tiêu chí này. Bạn muốn mình nới điều kiện hay đổi hướng tìm?`
  }
  const lean = topPick ? ` Mình nghiêng về **${topPick}** trước.` : ''
  switch (mode) {
    case 'shop':
      return topic
        ? `${name}Shop **${topic}** đang có vài món đáng xem.${lean}`
        : `${name}Có vài món từ shop này khá ổn.${lean}`
    case 'budget':
      return topic
        ? `${name}Budget **${topic}** thì chơi được kha khá lựa chọn rồi.${lean}`
        : `${name}Tầm giá này có vài option đáng cân nhắc.${lean}`
    case 'cheapest':
      return `${name}Nếu ưu tiên tiết kiệm thì đây là những lựa chọn mềm nhất đang bán.${lean}`
    case 'affordable':
      return topic
        ? `${name}**${topic}** giá dễ chịu thì có vài con khá ngon.${lean}`
        : `${name}Mấy lựa chọn giá dễ mua này đáng xem.${lean}`
    default:
      return topic
        ? `${name}Với **${topic}** thì có vài lựa chọn ổn.${lean}`
        : `${name}Yep, có vài option khá ngon.${lean}`
  }
}

function mergeShoppingCatalog(ctx: ChatContext, base: Product[]): Product[] {
  const map = new Map<string, Product>()
  for (const p of base) map.set(String(p.id), p)
  for (const p of ctx.enrichment?.searchResults ?? []) map.set(String(p.id), p)
  for (const p of ctx.enrichment?.categoryProducts ?? []) map.set(String(p.id), p)
  return [...map.values()]
}

function shoppingStructuredReply(
  ctx: ChatContext,
  raw: string,
  intent: ChatIntent | null,
): AssistantReplyPayload | null {
  const baseCatalog = pickProductCatalog(ctx.products, ctx.sellerProducts, ctx.role)
  const catalog = mergeShoppingCatalog(ctx, baseCatalog)
  if (!catalog.length) return null

  // Không bao giờ biến câu đơn hàng / tài khoản thành tìm SP
  if (intent && NON_SHOPPING_INTENTS.has(intent)) return null

  const locale = buildProcessingLocale(raw)
  const lower = locale.processing

  if (intent === 'shop_overview' || intent === 'categories' || isShopCatalogQuestion(lower)) {
    return null
  }

  if (intent === 'category_browse') {
    const matched = matchCategoryFromText(raw, ctx.categories)
    const focusLabel = matched?.name ?? stripCategoryBrowseQuery(raw)
    let hits = ctx.enrichment?.categoryProducts?.length
      ? ctx.enrichment.categoryProducts
      : matched
        ? filterProductsByCategory(catalog, matched.name, ctx.categories)
        : []
    if (!hits.length && focusLabel.length >= 2) {
      hits = findProductsByQuery(catalog, focusLabel)
    }
    if (hits.length) {
      return {
        content: warmProductIntro(
          ctx,
          hits.length,
          matched?.name ?? hits[0]?.category,
          'search',
          hits[0]?.name,
        ),
        products: toChatProducts(hits, 6),
      }
    }
    return null
  }

  if (isAmbiguousShoppingQuery(lower)) {
    return {
      content: discoveryReplyIntro(ctx.userName, 0, 'clarify'),
    }
  }

  if (asksProductDiscovery(lower)) {
    const hits = isDiscoveryNewestQuery(lower)
      ? newestProducts(catalog, 6)
      : rankRecommendedProducts(catalog, 6)
    return {
      content: discoveryReplyIntro(
        ctx.userName,
        hits.length,
        isDiscoveryNewestQuery(lower) ? 'newest' : 'recommend',
        hits[0]?.name,
      ),
      products: hits.length ? toChatProducts(hits, 6) : undefined,
    }
  }

  const range = extractPriceRange(raw)
  const filter = filterProductsForQuery(catalog, raw, ctx.categories, 8)
  const sellerQ = extractSellerNameQuery(raw)
  // Không biến follow-up thuộc tính SP thành tìm kiếm catalog
  if (intent && METADATA_INTENTS.has(intent)) return null

  const wantsShop =
    Boolean(range) ||
    Boolean(sellerQ) ||
    isAffordableProductQuery(raw) ||
    (intent != null && SHOPPING_INTENTS.has(intent) && !METADATA_INTENTS.has(intent)) ||
    // Chỉ search mù khi chưa nhận ra intent và câu có từ khóa sản phẩm rõ
    (intent == null &&
      Boolean(filter.queryText) &&
      filter.products.length > 0 &&
      filter.queryText.split(/\s+/).some((w) => w.length >= 3))

  if (!wantsShop) return null

  if (isAffordableProductQuery(raw)) {
    const label = extractProductFocusLabel(raw)
    const hits = affordableProductsForQuery(catalog, raw, 6)
    if (hits.length) {
      return {
        content: warmProductIntro(ctx, hits.length, label, 'affordable', hits[0]?.name),
        products: toChatProducts(hits, 6),
      }
    }
    return {
      content: `${greet(ctx.userName ?? '')}Chưa thấy **${label}** khớp trên shop. Bạn thử từ khóa khác hoặc nới điều kiện một chút?`,
    }
  }

  // "sản phẩm của [tên seller/shop]" — ưu tiên trước rẻ nhất / stats
  if (sellerQ) {
    const hits = findProductsBySellerName(catalog, sellerQ)
    const label = sellerQ
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    if (hits.length) {
      const sellers = toChatSellers(hits, 1, { showContact: true })
      return {
        content: warmProductIntro(ctx, hits.length, label, 'shop', hits[0]?.name),
        products: toChatProducts(hits, 6),
        sellers,
      }
    }
    return {
      content: `${greet(ctx.userName ?? '')}Chưa thấy shop/người bán **${label}** đang bán trên SEDSP. Thử đúng tên shop trên thẻ sản phẩm nhé.`,
    }
  }

  // "giá macbook/tai nghe trung bình" → tính TB / min / max đúng nhóm SP
  if (isPriceStatsQuery(raw) || /gia.+(macbook|iphone|laptop|tai nghe|airpod)/.test(normalizeText(raw))) {
    const focusLabel = extractProductFocusLabel(raw)
    const searchText = filter.queryText || raw
    const statsHits = findProductsByQuery(catalog, searchText)
    // Không fallback sang filter.products (dễ lẫn serum/bếp khi synonym nhiễu)
    const stats = computeProductPriceStats(statsHits, focusLabel, 4)
    if (stats) {
      const name = greet(ctx.userName ?? '')
      const spread = stats.max - stats.min
      const insight =
        spread / stats.average > 0.35
          ? `Khoảng giá khá rộng — nên chốt ngân sách trước khi chọn cấu hình.`
          : `Mức giá trong nhóm khá sát nhau, dễ so sánh.`
      return {
        content:
          `${name}**Giá ${stats.label}** trên SEDSP (theo **${stats.count}** SP đang bán):\n` +
          `• Trung bình: **${formatVnd(stats.average)}**\n` +
          `• Thấp nhất: **${formatVnd(stats.min)}** — **${stats.cheapest.name}**\n` +
          `• Cao nhất: **${formatVnd(stats.max)}** — **${stats.priciest.name}**\n\n` +
          `${insight}\n\n` +
          `Một vài lựa chọn tiêu biểu:`,
        products: toChatProducts(stats.products, 4),
      }
    }
    return {
      content: `${greet(ctx.userName ?? '')}Chưa tìm thấy sản phẩm **${focusLabel}** đang bán để tính giá trung bình. Thử tên khác (vd: "tai nghe bluetooth", "AirPods") hoặc mở **Cửa hàng**.`,
    }
  }

  if (intent === 'product_cheapest' || (/re nhat|cheapest|gia thap nhat/.test(normalizeText(raw)) && !range && !sellerQ)) {
    const cheap = cheapestProducts(catalog, 4)
    if (!cheap.length) return null
    const floor = formatVnd(cheap[0].price)
    const sameCount = cheap.length
    return {
      content:
        warmProductIntro(ctx, sameCount, undefined, 'cheapest', cheap[0]?.name) +
        (sameCount === 1
          ? ` **${cheap[0].name}** đang ở mức **${floor}**.`
          : ` Mức thấp nhất khoảng **${floor}**.`),
      products: toChatProducts(cheap, 4),
    }
  }

  if (filter.products.length) {
    const policy = searchProductsWithPolicy(catalog, raw)
    if (!policy.allowCards) {
      return {
        content: presentProductSearchResult(policy, ctx.userName),
      }
    }
    // Có keyword + giá → intro kiểu search (tránh giọng “chỉ lọc tầm giá” khi đã hỏi loại SP)
    const mode: IntroMode =
      filter.range && !filter.queryText ? 'budget' : filter.range ? 'search' : 'search'
    const rangeLabel =
      filter.range && !filter.queryText ? formatPriceRangeLabel(filter.range) : filter.queryText || undefined
    return {
      content: warmProductIntro(
        ctx,
        policy.products.length,
        rangeLabel,
        mode,
        policy.products[0]?.name,
      ),
      products: toChatProducts(policy.products, 6),
    }
  }

  if (range) {
    const focus = filter.queryText
      ? extractProductFocusLabel(raw)
      : formatPriceRangeLabel(range)
    return {
      content: filter.queryText
        ? `${greet(ctx.userName ?? '')}Trong khoảng **${formatPriceRangeLabel(range)}** mình chưa thấy **${focus}** khớp. Bạn muốn nới budget thêm một chút hay giữ mức này?`
        : `${greet(ctx.userName ?? '')}Trong khoảng **${formatPriceRangeLabel(range)}** mình chưa thấy mẫu nào. Nới ngân sách thêm khoảng 300–500k thường sẽ có nhiều lựa chọn hơn.`,
    }
  }

  return null
}

function resolveAttachedProducts(
  ctx: ChatContext,
  attachments: ChatProductRef[] | undefined,
): Product[] {
  if (!attachments?.length) return []
  const catalog = pickProductCatalog(ctx.products, ctx.sellerProducts, ctx.role)
  const out: Product[] = []
  for (const a of attachments) {
    const found = catalog.find((p) => String(p.id) === String(a.id))
    if (found) {
      // Catalog chat load với withStock — nguồn tồn kho đúng hơn payload kéo (list hay để stock=0)
      out.push({
        ...found,
        name: a.name || found.name,
        price: typeof a.price === 'number' ? a.price : found.price,
        imageUrl: a.imageUrl || found.imageUrl,
        category: a.category || found.category,
        shopName: a.shopName || found.shopName,
        description: found.description || a.name,
      })
    } else {
      out.push({
        id: a.id,
        name: a.name,
        description: '',
        price: a.price,
        originalPrice: a.originalPrice,
        stock: a.stock ?? 0,
        category: a.category ?? '',
        imageUrl: a.imageUrl,
        sellerId: '',
        shopName: a.shopName,
        rating: a.rating ?? 0,
        soldCount: 0,
        createdAt: '',
      })
    }
  }
  return out
}

function reviewContextForAttached(ctx: ChatContext, product: Product): ChatContext {
  const sameId =
    ctx.enrichment?.productId != null &&
    String(ctx.enrichment.productId) === String(product.id)
  return {
    ...ctx,
    enrichment: {
      ...ctx.enrichment,
      productId: product.id,
      product,
      ratingSummary: sameId ? ctx.enrichment?.ratingSummary : undefined,
      reviews: sameId ? ctx.enrichment?.reviews : undefined,
    },
  }
}

function isAmbiguousProductOpinion(lower: string): boolean {
  const n = normalizeChatTypos(lower)
  if (asksProductReview(n)) return true
  const words = n.split(/\s+/).filter(Boolean)
  if (words.length > 6) return false
  return (
    /^(sao|the nao|ra sao|on khong|tot khong|duoc khong|the)$/.test(n) ||
    /nguoi ta|moi nguoi|khach hang/.test(n)
  )
}

function attachmentReply(
  ctx: ChatContext,
  raw: string,
  attachments: ChatProductRef[],
): AssistantReplyPayload | null {
  if (!attachments.length) return null
  const name = greet(ctx.userName ?? '')
  const products = resolveAttachedProducts(ctx, attachments)
  const lower = normalizeChatTypos(normalizeText(raw))
  const cards = toChatProducts(products, 4)

  if (products.length >= 2 && /so sanh|compare|khac nhau|nen mua|hon|vs/.test(lower)) {
    const lines = products
      .map(
        (p, i) =>
          `${i + 1}. **${p.name}** — ${formatVnd(p.price)} · ${p.category || '—'} · ${stockPhrase(p.stock)} · ${p.rating ? `${p.rating}★` : ''}`,
      )
      .join('\n')
    const cheapest = [...products].sort((a, b) => a.price - b.price)[0]
    return {
      content: `${name}**So sánh ${products.length} sản phẩm đã đính kèm**:\n${lines}\n\n💡 Giá thấp nhất: **${cheapest.name}** (${formatVnd(cheapest.price)}).`,
      products: cards,
    }
  }

  const top = products[0]
  if (asksProductReview(lower)) {
    const built = productReviewReply(reviewContextForAttached(ctx, top), raw, top)
    return {
      content: built.text,
      reviewSummary: built.reviewSummary,
      products: cards.slice(0, 1),
    }
  }
  if (asksProductOrigin(lower)) {
    return {
      content: productOriginReply(ctx, top),
      products: cards.slice(0, 1),
    }
  }
  if (asksProductListedDate(lower)) {
    return {
      content: productListedReply(ctx, top),
      products: cards.slice(0, 1),
    }
  }
  if (asksSellerInfo(lower)) {
    const catalog = pickProductCatalog(ctx.products, ctx.sellerProducts, ctx.role)
    const seller = sellerCardFromProduct(top, catalog, { showContact: true })
    const greetName = greet(ctx.userName ?? '')
    return {
      content: seller
        ? sellerShopSummaryReply(greetName, seller, top.name)
        : `${greetName}Shop **${top.shopName ?? 'SEDSP Official'}** đang bán **${top.name}**.`,
      sellers: seller ? [seller] : undefined,
      products: cards.slice(0, 1),
    }
  }
  if (asksProductPrice(lower)) {
    return {
      content: `${name}**${top.name}** đang bán **${formatVnd(top.price)}**.`,
      products: cards.slice(0, 1),
    }
  }
  if (/con hang|het hang|ton|stock/.test(lower)) {
    return {
      content: `${name}**${top.name}**: ${
        top.stock == null
          ? 'chưa lấy được tồn kho — thử lại hoặc mở trang SP.'
          : top.stock <= 0
            ? 'hiện **hết hàng**'
            : `còn khoảng **${top.stock}**`
      }.`,
      products: cards.slice(0, 1),
    }
  }

  // Công dụng / mô tả / dùng để làm gì
  if (/cong dung|mo ta|dung de|dung lam|la gi|what is|what does|tinh nang|dac diem|gioi thieu|cho minh biet|ve san pham|ve no/.test(lower)) {
    const desc = top.description?.trim()
    const useLine = desc
      ? desc.slice(0, 280) + (desc.length > 280 ? '…' : '')
      : `${top.name} thuộc danh mục **${top.category || 'sản phẩm'}**, phù hợp nhu cầu mua sắm trên SEDSP.`
    return {
      content: `${name}**${top.name}** — công dụng / mô tả:\n${useLine}\n\nGiá hiện tại **${formatVnd(top.price)}** · shop **${top.shopName ?? 'SEDSP'}**.`,
      products: cards.slice(0, 1),
    }
  }

  if (isAmbiguousProductOpinion(lower)) {
    const built = productReviewReply(reviewContextForAttached(ctx, top), raw, top)
    return {
      content: built.text,
      reviewSummary: built.reviewSummary,
      products: cards.slice(0, 1),
    }
  }

  const desc = top.description?.trim()
  if (desc) {
    return {
      content: `${name}**${top.name}**: ${desc.slice(0, 220)}${desc.length > 220 ? '…' : ''}\n\nGiá **${formatVnd(top.price)}**.`,
      products: cards.slice(0, 1),
    }
  }

  return {
    content: `${name}Bạn đang hỏi về **${top.name}** (${formatVnd(top.price)}, danh mục ${top.category || '—'}).\nMình chưa có mô tả chi tiết — mở trang SP hoặc hỏi **giá**, **còn hàng**, **đánh giá khách**.`,
    products: cards.slice(0, 1),
  }
}

function smartProductFallback(
  ctx: ChatContext,
  raw: string,
  matched: Product[],
): AssistantReplyPayload | null {
  if (!matched.length) return null
  const name = greet(ctx.userName ?? '')
  const lower = normalizeText(raw)
  // Không fallback SP khi câu hỏi thuộc đơn / tài khoản / chính sách
  if (
    /don hang|don cua|trang thai don|lich su mua|theo doi don|gio hang|thanh toan|doi tra|bao hanh|dang nhap|mat khau/.test(
      lower,
    )
  ) {
    return null
  }
  const top = matched[0]
  const cards = toChatProducts(matched, 4)

  if (asksProductPrice(lower)) {
    return {
      content: `${name}**${top.name}** đang bán **${formatVnd(top.price)}**.`,
      products: cards,
    }
  }
  if (/con hang|het hang|ton|stock|available|con khong/.test(lower)) {
    return {
      content: `${name}**${top.name}**: ${top.stock <= 0 ? 'hiện **hết hàng**' : `còn khoảng **${top.stock}**`}.`,
      products: cards.slice(0, 1),
    }
  }
  if (asksProductReview(lower)) {
    const built = productReviewReply(ctx, raw, top)
    return {
      content: built.text,
      reviewSummary: built.reviewSummary,
      products: cards.slice(0, 1),
    }
  }
  if (asksProductOrigin(lower)) {
    return {
      content: productOriginReply(ctx, top),
      products: cards.slice(0, 1),
    }
  }
  if (asksProductListedDate(lower)) {
    return {
      content: productListedReply(ctx, top),
      products: cards.slice(0, 1),
    }
  }
  if (asksSellerInfo(lower)) {
    const catalog = pickProductCatalog(ctx.products, ctx.sellerProducts, ctx.role)
    const seller = sellerCardFromProduct(top, catalog, { showContact: true })
    const greetName = greet(ctx.userName ?? '')
    return {
      content: seller
        ? sellerShopSummaryReply(greetName, seller, top.name)
        : `${greetName}Shop **${top.shopName ?? 'SEDSP Official'}** đang bán **${top.name}**.`,
      sellers: seller ? [seller] : undefined,
      products: cards.slice(0, 1),
    }
  }
  if (/lien he|seller|nguoi ban|shop|cho nao|o dau ban/.test(lower)) {
    return {
      content: `${name}Shop **${top.shopName ?? 'SEDSP Official'}** đang bán **${top.name}**.\nEmail: ${top.sellerEmail ?? 'seller@sedsp.vn'} · SĐT: ${top.sellerPhone ?? '1900-SEDSP'}`,
      products: cards.slice(0, 1),
    }
  }

  return {
    content: warmProductIntro(
      ctx,
      Math.min(matched.length, 4),
      undefined,
      'search',
      matched[0]?.name,
    ),
    products: cards,
  }
}

export async function generateAssistantReply(
  text: string,
  ctx: ChatContext,
  attachments?: ChatProductRef[],
  resolvedIntent?: ChatIntent | null,
): Promise<AssistantReplyPayload> {
  const raw = text.trim()
  const locale = buildProcessingLocale(raw)
  const lower = locale.processing
  const finish = (payload: AssistantReplyPayload) => wrapReply(payload, ctx, raw)

  if (!raw && !attachments?.length) {
    return finish({ content: 'Bạn muốn hỏi gì về sản phẩm, giỏ hàng hay đơn hàng?' })
  }

  if (raw && isOffTopic(lower) && !attachments?.length) {
    return finish({
      content:
        'Mình là trợ lý mua sắm SEDSP nên chỉ hỗ trợ **sản phẩm, giỏ hàng, đơn hàng và chính sách shop**. Câu hỏi này nằm ngoài phạm vi — bạn hỏi giúp mình về mua sắm nhé!',
    })
  }

  // In-domain nhưng quá mơ hồ — hỏi lại, không gắn card SP ngẫu nhiên
  if (raw && isAmbiguousShoppingQuery(lower)) {
    return finish({
      content: discoveryReplyIntro(ctx.userName, 0, 'clarify'),
    })
  }

  const attached = attachmentReply(ctx, raw || 'cho tôi thông tin', attachments ?? [])
  if (attached && attachments?.length) {
    const attachIntent = resolveAttachmentFollowUpIntent(lower)
    const skipFollowUp = Boolean(attached.reviewSummary)
    return finish({
      content:
        attached.content + (skipFollowUp ? '' : followUps(attachIntent, ctx.role)),
      products: attached.products,
      sellers: attached.sellers,
      reviewSummary: attached.reviewSummary,
    })
  }

  const detected = detectIntent(raw, ctx.role)
  let intent = resolvedIntent !== undefined ? resolvedIntent : detected?.intent ?? null

  const budget = extractBudgetVnd(raw)
  const range = extractPriceRange(raw)
  if ((budget != null && budget > 0) || range) {
    if (
      !intent ||
      intent === 'product_budget' ||
      intent === 'promo' ||
      intent === 'product_search'
    ) {
      intent = 'product_budget'
    }
  }

  // where_to_buy / recommend: ưu tiên reply chỉ seller, không qua shopping generic
  if (intent !== 'where_to_buy' && intent !== 'recommend') {
    const shopping = shoppingStructuredReply(ctx, raw, intent)
    if (shopping) {
      return finish({
        content: shopping.content + followUps(intent, ctx.role),
        products: shopping.products,
        sellers: shopping.sellers,
      })
    }
  }

  if (intent) {
    let reviewSummary: ChatReviewSummary | undefined
    let reply: string | null = null
    if (intent === 'product_review' || asksProductReview(lower)) {
      const focus = ctx.enrichment?.product
      if (focus) {
        const built = productReviewReply(ctx, raw, focus)
        reply = built.text
        reviewSummary = built.reviewSummary
      }
    }
    if (!reply) {
      reply = buildIntentReply(ctx, intent, raw)
    }
    if (reply) {
      const catalog = pickProductCatalog(ctx.products, ctx.sellerProducts, ctx.role)
      const filterHits =
        intent === 'where_to_buy' || intent === 'recommend'
          ? filterProductsForQuery(catalog, raw, ctx.categories, 8).products
          : []
      const ranked =
        intent === 'recommend'
          ? asksProductDiscovery(lower)
            ? newestProducts(
                ctx.enrichment?.searchResults?.length
                  ? ctx.enrichment.searchResults
                  : filterHits.length
                    ? filterHits
                    : catalog,
                6,
              )
            : rankRecommendedProducts(
                ctx.enrichment?.searchResults?.length
                  ? ctx.enrichment.searchResults
                  : filterHits.length
                    ? filterHits
                    : catalog,
                6,
              )
          : []
      const insightHighlights =
        intent === 'shop_overview' ||
        intent === 'categories' ||
        intent === 'seller_top_products'
          ? catalogInsightHighlights(ctx, intent)
          : []
      const enrichProducts =
        intent === 'category_browse' || intent === 'categories'
          ? (() => {
              const matched = matchCategoryFromText(raw, ctx.categories)
              const fromCat = ctx.enrichment?.categoryProducts?.length
                ? ctx.enrichment.categoryProducts
                : matched
                  ? filterProductsByCategory(catalog, matched.name, ctx.categories)
                  : []
              if (fromCat.length) return fromCat
              return undefined
            })() ??
            (ranked.length
              ? ranked
              : insightHighlights.length
                ? insightHighlights
                : ctx.enrichment?.searchResults?.length
                  ? ctx.enrichment.searchResults
                  : ctx.enrichment?.categoryProducts?.length
                    ? ctx.enrichment.categoryProducts
                    : filterHits.length
                      ? filterHits
                      : ctx.enrichment?.product
                        ? [ctx.enrichment.product]
                        : undefined)
          : ranked.length
            ? ranked
            : insightHighlights.length
              ? insightHighlights
              : ctx.enrichment?.searchResults?.length
                ? ctx.enrichment.searchResults
                : ctx.enrichment?.categoryProducts?.length
                  ? ctx.enrichment.categoryProducts
                  : filterHits.length
                    ? filterHits
                    : ctx.enrichment?.product
                      ? [ctx.enrichment.product]
                      : undefined
      const productPool = enrichProducts ?? []
      let sellers = resolveReplySellers(ctx, intent, raw, catalog, productPool)
      if (
        sellers?.length &&
        enrichProducts?.length &&
        intent &&
        ['product_price', 'product_info', 'product_review', 'product_stock', 'category_browse'].includes(
          intent,
        )
      ) {
        sellers = undefined
      }
      let products: ReturnType<typeof toChatProducts> | undefined
      if (intent && NON_SHOPPING_INTENTS.has(intent)) {
        products = undefined
      } else if (intent === 'contact_seller' && sellers?.length) {
        products = undefined
      } else if (intent === 'product_search') {
        const policy = searchProductsWithPolicy(catalog, raw)
        products = policy.allowCards ? toChatProducts(policy.products, 6) : undefined
      } else if (enrichProducts?.length) {
        products = toChatProducts(enrichProducts, 6)
      }
      let content =
        reply +
        (intent === 'product_review' && reviewSummary ? '' : followUps(intent, ctx.role))
      return finish({ content, products, sellers, reviewSummary })
    }
  }

  const catalog = pickProductCatalog(ctx.products, ctx.sellerProducts, ctx.role)
  // Không fallback tìm SP khi đã biết là đơn hàng / tài khoản / chính sách
  if (intent && NON_SHOPPING_INTENTS.has(intent)) {
    return finish({
      content: escalateReply(ctx, raw, 'unknown'),
    })
  }

  const searchHits = ctx.enrichment?.searchResults
  const policy = searchProductsWithPolicy(
    searchHits?.length ? searchHits : catalog,
    raw,
  )
  const matched = policy.allowCards ? policy.products : []

  if (!matched.length && policy.matchTier === 'none' && policy.specificLabel) {
    return finish({
      content: presentProductSearchResult(policy, ctx.userName) + followUps(null, ctx.role),
    })
  }

  const smart = smartProductFallback(ctx, raw, matched)
  if (smart) {
    return finish({
      content: smart.content + followUps(null, ctx.role),
      products: smart.products,
    })
  }

  if (
    (/\bre nhat\b|gia thap nhat|cheapest/.test(lower) ||
      (/\bgia re\b/.test(lower) && !extractAffordableSearchTerms(raw).length)) &&
    catalog.length
  ) {
    const cheap = cheapestProducts(catalog, 4)
    if (cheap.length) {
      const floor = formatVnd(cheap[0].price)
      return finish({
        content:
          warmProductIntro(ctx, cheap.length, undefined, 'cheapest', cheap[0]?.name) +
          (cheap.length === 1
            ? ` **${cheap[0].name}** đang ở mức **${floor}**.`
            : ` Mức thấp nhất khoảng **${floor}**.`),
        products: toChatProducts(cheap, 4),
      })
    }
  }

  if (budget != null && catalog.length) {
    const hits = productsUnderBudget(catalog, budget, 6)
    if (hits.length) {
      return finish({
        content:
          warmProductIntro(ctx, hits.length, formatVnd(budget), 'budget', hits[0]?.name) +
          sellerHintFromProducts(hits),
        products: toChatProducts(hits, 6),
      })
    }
    return finish({
      content: `${greet(ctx.userName ?? '')}Trong tầm **${formatVnd(budget)}** mình chưa thấy mẫu khớp. Bạn muốn nới thêm một chút hay hỏi món rẻ nhất đang có?`,
    })
  }

  if (/dang nhap|login|sign in/.test(lower) && ctx.role === 'guest') {
    return finish({
      content: `${greet(ctx.userName ?? '')}**Đăng nhập** role Khách hàng để mua hàng, xem đơn & gợi ý AI.\nDemo: **customer@sedsp.vn** / **12345678**`,
    })
  }

  return finish({ content: escalateReply(ctx, raw, 'unknown') })
}

export function typingDelay(content: string): number {
  // Instant for long replies; tiny pause only for very short canned lines
  if (content.length > 80) return 0
  return Math.min(120, Math.max(0, Math.floor(content.length * 2)))
}

export function formatChatHtml(content: string): string {
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(
      /(\/(?:products|orders|seller\/orders|seller\/dss\/[\w-]+|manager\/dss\/[\w-]+)(?:\/[\w-]+)?)/g,
      '<a href="$1">$1</a>',
    )
}
