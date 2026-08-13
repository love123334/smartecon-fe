import type { ChatContext } from '@/api/chat/context'
import { detectIntent, type ChatIntent } from '@/api/chat/intents'
import { formatVnd, normalizeText, asksProductListedDate, asksProductOrigin, asksProductPrice, asksProductReview, asksSellerInfo } from '@/api/chat/match'
import { toChatProducts } from '@/api/chat/productCards'
import { resolveReplySellers, sellerCardFromProduct, toChatSellers } from '@/api/chat/sellerCards'
import {
  cheapestProducts,
  affordableProductsForQuery,
  computeProductPriceStats,
  extractAffordableSearchTerms,
  extractBudgetVnd,
  extractPriceRange,
  extractProductFocusLabel,
  extractProductSearchTerms,
  extractSellerNameQuery,
  filterProductsForQuery,
  findProductsByQuery,
  findProductsBySellerName,
  formatPriceRangeLabel,
  groupProductsByShop,
  isAffordableProductQuery,
  isPriceStatsQuery,
  pickProductCatalog,
  productsUnderBudget,
  rankRecommendedProducts,
} from '@/api/chat/products'
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

function wrapReply(payload: AssistantReplyPayload): AssistantReplyPayload {
  return { ...payload, content: sanitizeChatReply(payload.content) }
}

function resolveAttachmentFollowUpIntent(lower: string): ChatIntent | null {
  if (asksProductReview(lower)) return 'product_review'
  if (asksSellerInfo(lower)) return 'contact_seller'
  if (asksProductOrigin(lower) || asksProductListedDate(lower)) return 'product_info'
  if (asksProductPrice(lower)) return 'product_price'
  if (/con hang|het hang|ton|stock/.test(lower)) return 'product_stock'
  return null
}
function followUps(intent: ChatIntent | null, role: ChatContext['role']): string {
  // Gợi ý ngắn, không checklist cứng
  const tips: Partial<Record<ChatIntent, string>> = {
    shop_overview: '\n\nMuốn mình lọc theo danh mục hoặc ngân sách không?',
    product_price: '\n\nCần check còn hàng hoặc review không?',
    product_review: '\n\nXem thêm nhận xét đầy đủ trên trang sản phẩm nhé.',
    product_stock: '\n\nThêm vào giỏ trên trang sản phẩm nếu bạn ưng.',
    cart_summary: '\n\nSẵn thì hỏi mình cách thanh toán nhé.',
    orders: '\n\nHỏi chi tiết đơn #… nếu cần.',
    where_to_buy: '\n\nHỏi "liên hệ người bán …" để lấy email/SĐT shop.',
    contact_seller: '\n\nBấm danh thiếp shop bên dưới để xem SP tiêu biểu.',
    recommend: '\n\nThu hẹp thêm bằng ngân sách hoặc danh mục cũng được.',
    product_budget: '\n\nKéo SP vào chat để so sánh nhanh.',
    product_search: '\n\nThêm "dưới X triệu" nếu muốn lọc giá.',
  }
  if (intent && tips[intent]) return tips[intent]
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

function warmProductIntro(
  ctx: ChatContext,
  count: number,
  topic?: string,
  mode: IntroMode = 'search',
): string {
  const name = greet(ctx.userName ?? '')
  if (count <= 0) {
    return `${name}Mình chưa thấy sản phẩm phù hợp${topic ? ` cho **${topic}**` : ''} trên shop lúc này. Bạn thử từ khóa khác hoặc mở **Cửa hàng** nhé.`
  }
  const topicBit = topic ? ` về **${topic}**` : ''
  switch (mode) {
    case 'shop':
      return `${name}Mình tìm được **${count}** sản phẩm từ shop **${topic}** — mời bạn xem qua nhé.`
    case 'budget':
      return `${name}Trong tầm giá bạn hỏi, mình lọc được **${count}** lựa chọn${topicBit} — tham khảo bên dưới nhé.`
    case 'cheapest':
      return `${name}Đây là **${count}** lựa chọn giá mềm nhất mình tìm được${topicBit} — xem thử nhé.`
    case 'affordable':
      return `${name}Mình gom **${count}** món **${topic}** giá hợp lý trên shop — bạn tham khảo nhé.`
    default:
      return `${name}Rất vui vì bạn đã hỏi! Mình tìm được **${count}** gợi ý liên quan${topicBit} — mời bạn tham khảo bên dưới nhé.`
  }
}

function shoppingStructuredReply(
  ctx: ChatContext,
  raw: string,
  intent: ChatIntent | null,
): AssistantReplyPayload | null {
  const catalog = pickProductCatalog(ctx.products, ctx.sellerProducts, ctx.role)
  if (!catalog.length) return null

  // Không bao giờ biến câu đơn hàng / tài khoản thành tìm SP
  if (intent && NON_SHOPPING_INTENTS.has(intent)) return null

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
        content: warmProductIntro(ctx, hits.length, label, 'affordable'),
        products: toChatProducts(hits, 6),
      }
    }
    return {
      content: `${greet(ctx.userName ?? '')}Chưa thấy **${label}** trên shop.\n\nThử từ khóa khác (tai nghe, giày, laptop…) hoặc mở **Cửa hàng** / **Tìm kiếm**.`,
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
        content: warmProductIntro(ctx, hits.length, label, 'shop'),
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
        warmProductIntro(ctx, sameCount, undefined, 'cheapest') +
        (sameCount === 1
          ? `\n\n**${cheap[0].name}** — **${floor}**.`
          : `\n\nMức thấp nhất **${floor}**, có **${sameCount}** sản phẩm cùng mức này.`),
      products: toChatProducts(cheap, 4),
    }
  }

  if (filter.products.length) {
    const topic = filter.queryText || (filter.range ? formatPriceRangeLabel(filter.range) : undefined)
    const mode: IntroMode = filter.range ? 'budget' : 'search'
    return {
      content: warmProductIntro(ctx, filter.products.length, topic, mode),
      products: toChatProducts(filter.products, 6),
    }
  }

  if (range) {
    return {
      content: `${greet(ctx.userName ?? '')}Không có sản phẩm trong khoảng **${formatPriceRangeLabel(range)}**. Thử nới ngân sách hoặc hỏi "sp rẻ nhất" nhé.`,
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

function attachmentReply(
  ctx: ChatContext,
  raw: string,
  attachments: ChatProductRef[],
): AssistantReplyPayload | null {
  if (!attachments.length) return null
  const name = greet(ctx.userName ?? '')
  const products = resolveAttachedProducts(ctx, attachments)
  const lower = normalizeText(raw)
  const cards = toChatProducts(products, 4)

  if (products.length >= 2 && (/so sanh|compare|khac nhau|nen mua|hon|vs/.test(lower) || !lower || lower.length < 12)) {
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
      content: `${name}**${top.name}** đang bán **${formatVnd(top.price)}**${top.originalPrice && top.originalPrice > top.price ? ` (gốc ${formatVnd(top.originalPrice)})` : ''}.`,
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
      content: `${name}**${top.name}** — công dụng / mô tả:\n${useLine}\n\nGiá hiện tại **${formatVnd(top.price)}** · shop **${top.shopName ?? 'SEDSP'}**. Bạn muốn hỏi thêm giá, còn hàng, hay so sánh với SP khác?`,
      products: cards.slice(0, 1),
    }
  }

  const desc = top.description?.trim()
  if (desc) {
    return {
      content: `${name}**${top.name}**: ${desc.slice(0, 220)}${desc.length > 220 ? '…' : ''}\n\nGiá **${formatVnd(top.price)}**. Hỏi thêm: công dụng, giá, còn hàng, hoặc kéo thêm SP để so sánh.`,
      products: cards.slice(0, 1),
    }
  }

  return {
    content: `${name}Bạn đang hỏi về **${top.name}** (${formatVnd(top.price)}, danh mục ${top.category || '—'}).\nMình chưa có mô tả chi tiết — bạn mở trang SP hoặc hỏi cụ thể: **công dụng**, **giá**, **còn hàng**.`,
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
      content: `${name}**${top.name}** đang bán **${formatVnd(top.price)}**${top.originalPrice && top.originalPrice > top.price ? ` (gốc ${formatVnd(top.originalPrice)})` : ''}.`,
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
    content: warmProductIntro(ctx, Math.min(matched.length, 4), undefined, 'search'),
    products: cards,
  }
}

export async function generateAssistantReply(
  text: string,
  ctx: ChatContext,
  attachments?: ChatProductRef[],
): Promise<AssistantReplyPayload> {
  const raw = text.trim()
  const lower = normalizeText(raw)

  if (!raw && !attachments?.length) {
    return wrapReply({ content: 'Bạn muốn hỏi gì về sản phẩm, giỏ hàng hay đơn hàng?' })
  }

  if (raw && isOffTopic(lower) && !attachments?.length) {
    return wrapReply({
      content:
        'Mình là trợ lý mua sắm SEDSP nên chỉ hỗ trợ **sản phẩm, giỏ hàng, đơn hàng và chính sách shop**. Câu hỏi này nằm ngoài phạm vi — bạn hỏi giúp mình về mua sắm nhé!',
    })
  }

  const attached = attachmentReply(ctx, raw || 'cho tôi thông tin', attachments ?? [])
  if (attached && attachments?.length) {
    return wrapReply({
      content: attached.content + followUps(resolveAttachmentFollowUpIntent(lower), ctx.role),
      products: attached.products,
      sellers: attached.sellers,
      reviewSummary: attached.reviewSummary,
    })
  }

  const detected = detectIntent(raw, ctx.role)
  let intent = detected?.intent ?? null

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
      return wrapReply({
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
          ? rankRecommendedProducts(
              ctx.enrichment?.searchResults?.length
                ? ctx.enrichment.searchResults
                : filterHits.length
                  ? filterHits
                  : catalog,
              6,
            )
          : []
      const enrichProducts =
        ranked.length
          ? ranked
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
      const sellers = resolveReplySellers(ctx, intent, raw, catalog, productPool)
      const products =
        intent && NON_SHOPPING_INTENTS.has(intent)
          ? undefined
          : intent === 'contact_seller' && sellers?.length
            ? undefined
            : enrichProducts?.length
              ? toChatProducts(enrichProducts, 6)
              : undefined
      let content = reply + followUps(intent, ctx.role)
      // Giữ directory shop cho where_to_buy / recommend — không xóa bullet
      if (
        products?.length &&
        intent !== 'where_to_buy' &&
        intent !== 'recommend' &&
        intent !== 'contact_seller' &&
        !content.includes('tham khảo') &&
        !content.includes('bên dưới')
      ) {
        content += `\n\nXem chi tiết trên từng card bên dưới nhé.`
      } else if (sellers?.length && !content.includes('bên dưới')) {
        content += `\n\nXem **danh thiếp shop** bên dưới nhé.`
      } else if (products?.length && (intent === 'where_to_buy' || intent === 'recommend')) {
        content += `\n\nChọn card bên dưới để xem SP nhé.`
      }
      return wrapReply({ content, products, sellers, reviewSummary })
    }
  }

  const catalog = pickProductCatalog(ctx.products, ctx.sellerProducts, ctx.role)
  // Không fallback tìm SP khi đã biết là đơn hàng / tài khoản / chính sách
  if (intent && NON_SHOPPING_INTENTS.has(intent)) {
    return wrapReply({
      content: escalateReply(ctx, raw, 'unknown'),
    })
  }

  const searchHits = ctx.enrichment?.searchResults
  const matched = searchHits?.length ? searchHits : findProductsByQuery(catalog, extractProductSearchTerms(raw) || raw)

  const smart = smartProductFallback(ctx, raw, matched)
  if (smart) {
    return wrapReply({
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
      return wrapReply({
        content:
          warmProductIntro(ctx, cheap.length, undefined, 'cheapest') +
          (cheap.length === 1
            ? `\n\n**${cheap[0].name}** — **${floor}**.`
            : `\n\nMức thấp nhất **${floor}**, có **${cheap.length}** sản phẩm cùng mức này.`),
        products: toChatProducts(cheap, 4),
      })
    }
  }

  if (budget != null && catalog.length) {
    const hits = productsUnderBudget(catalog, budget, 6)
    if (hits.length) {
      return wrapReply({
        content: warmProductIntro(ctx, hits.length, formatVnd(budget), 'budget') + sellerHintFromProducts(hits),
        products: toChatProducts(hits, 6),
      })
    }
    return wrapReply({
      content: `${greet(ctx.userName ?? '')}Không có SP trong ngân sách **${formatVnd(budget)}**. Thử mức cao hơn hoặc hỏi "sp rẻ nhất".`,
    })
  }

  if (/dang nhap|login|sign in/.test(lower) && ctx.role === 'guest') {
    return wrapReply({
      content: `${greet(ctx.userName ?? '')}**Đăng nhập** role Khách hàng để mua hàng, xem đơn & gợi ý AI.\nDemo: **customer@sedsp.vn** / **12345678**`,
    })
  }

  return wrapReply({ content: escalateReply(ctx, raw, 'unknown') })
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
