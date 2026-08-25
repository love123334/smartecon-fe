import { escalateReplyForRole, roleHelpHints } from '@/api/chat/rolePolicy'
import type { ChatContext } from '@/api/chat/context'
import type { ChatIntent } from '@/api/chat/intents'
import {
  demandBrief,
  extractDiscountPct,
  inventoryDssBrief,
  priceBrief,
  sellerWhatIfBrief,
} from '@/api/chat/dssBrief'
import {
  asksProductDiscovery,
  discoveryReplyIntro,
  isAmbiguousShoppingQuery,
  isDiscoveryNewestQuery,
} from '@/api/chat/discovery'
import { formatVnd, normalizeText, asksProductListedDate, asksProductOrigin } from '@/api/chat/match'
import {
  affordableProductsForQuery,
  cheapestProducts,
  computeProductPriceStats,
  extractBudgetVnd,
  extractPriceRange,
  extractProductFocusLabel,
  extractProductSearchTerms,
  filterProductsForQuery,
  filterProductsByCategory,
  findProductsByQuery,
  groupProductsByShop,
  isAffordableProductQuery,
  isPriceStatsQuery,
  stripPriceTokens,
} from '@/api/chat/products'
import {
  filterOrdersBySpec,
  parseOrderQuery,
  presentOrdersReply,
} from '@/api/chat/orderQuery'
import {
  presentProductSearchResult,
  searchProductsWithPolicy,
} from '@/api/chat/productMatch'
import {
  buildSellerAnalyticsReply,
  parseSellerBusinessQuery,
  presentRevenueReply,
} from '@/api/chat/sellerAnalytics'
import { matchCategoryFromText } from '@/api/chat/synonyms'
import {
  buildProductReviewSummary,
  buildReviewReplyText,
} from '@/api/chat/productReviewSummary'
import type { Order, Product, ChatReviewSummary, ChatSellerRef } from '@/types'
import { orderStatusLabel } from '@/utils/orderStatus'
import { salesEligibleOrders, totalRevenue } from '@/utils/orderAnalytics'
import { rankForUseCase } from '@/utils/recommendationScore'
import {
  buildCatalogInsight,
  buildRecommendInsight,
  buildSellerTopInsight,
  formatCatalogInsightReply,
  formatRecommendInsightReply,
  formatSellerTopInsightReply,
} from '@/api/chat/insightEngine'

export { findProductsByQuery } from '@/api/chat/products'

function findProductAttribute(product: Product, ...keys: string[]): string | null {
  if (!product.attributes?.length) return null
  for (const key of keys) {
    const needle = normalizeText(key)
    const hit = product.attributes.find((a) => normalizeText(a.name).includes(needle))
    if (hit?.value?.trim()) return hit.value.trim()
  }
  return null
}

export function formatProductListedDate(createdAt: string): string | null {
  if (!createdAt?.trim()) return null
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })
}

function productOriginText(product: Product): string | null {
  return (
    findProductAttribute(product, 'xuat xu', 'origin', 'made in', 'country', 'nguon goc') ??
    product.shopLocation?.trim() ??
    null
  )
}

function productMetadataLines(product: Product): string[] {
  const lines: string[] = []
  const origin = productOriginText(product)
  if (origin) lines.push(`• Xuất xứ: **${origin}**`)
  const listed = formatProductListedDate(product.createdAt)
  if (listed) lines.push(`• Lên kệ từ: **${listed}**`)
  if (product.soldCount > 0) lines.push(`• Đã bán: **${product.soldCount}**`)
  if (typeof product.reviewCount === 'number' && product.reviewCount > 0) {
    lines.push(`• Số đánh giá: **${product.reviewCount}**`)
  }
  return lines
}

function greet(name: string): string {
  const n = name?.trim()
  if (!n || n.length < 2) return ''
  if (/nguyen van khach|khach hang|guest|user\d+/i.test(n)) return ''
  if (/^[a-z0-9._-]+$/i.test(n) && !/\s/.test(n) && n.length < 24) return ''
  const first = n.split(/\s+/).pop() || n
  if (first.length < 2) return ''
  return `${first}, `
}

/** Bỏ note kỹ thuật + CTA dẫn UI card khỏi mọi phản hồi hiển thị cho user */
export function sanitizeChatReply(text: string): string {
  return text
    .replace(/\s*\((?:dữ liệu\s+)?API(?:\s*\+\s*demo)?\)/gi, '')
    .replace(/\s*\*\((?:API(?:\s+backend)?|mock[^*]*)\)\*/gi, '')
    .replace(/\s*\((?:API\s+inventory|tồn\s+API|API)\)/gi, '')
    .replace(/\s*\(API\s*\+\s*demo\)/gi, '')
    .replace(/\s*\(dữ liệu API\)/gi, '')
    .replace(/Nhận xét gần đây \(API\):/gi, 'Nhận xét gần đây:')
    .replace(/\*\*Top SP \(API\):\*\*/gi, '**Top SP:**')
    .replace(/\b(keyword|intent|extract|query term):\s*[^\n]+/gi, '')
    .replace(/\b(product_budget|product_search|product_cheapest)\b/gi, '')
    .replace(
      /(?:^|\n)\s*(?:User Safety|Response Safety|Phản hồi\s*[Aa]n toàn|Khống chế người dùng|Khoản người dùng)\s*:\s*[^\n]*/gi,
      '',
    )
    .replace(
      /\n*\n?(?:→\s*)?(?:Bấm|Chọn|Xem)(?:\s+chi tiết)?(?:\s+trên)?(?:\s+từng)?\s*(?:card|sản phẩm|\*\*danh thiếp shop\*\*).{0,80}(?:bên dưới|để xem).*/gi,
      '',
    )
    .replace(/\n*\n?👉\s*Xem\s+\*\*danh thiếp shop\*\*.*/gi, '')
    .replace(/\s*—?\s*xem thử bên dưới nhé\.?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function productLines(products: Product[], limit = 4): string {
  return products
    .slice(0, limit)
    .map((p) => {
      const shop = p.shopName ? ` · shop **${p.shopName}**` : ''
      const stockNote = p.stock <= 0 ? ' (hết hàng)' : p.stock < 10 ? ` (còn ${p.stock})` : ''
      const rating = p.rating ? ` · ${p.rating}★` : ''
      const link = p.id ? ` → /products/${p.id}` : ''
      return `• **${p.name}** — ${formatVnd(p.price)}${rating}${shop}${stockNote}${link}`
    })
    .join('\n')
}

function shopDirectoryLines(products: Product[], limitShops = 4): string {
  const groups = groupProductsByShop(products, limitShops, 2)
  if (!groups.length) return ''
  return groups
    .map((g) => {
      const items = g.products
        .map((p) => `${p.name} (${formatVnd(p.price)})`)
        .join(', ')
      const contact =
        g.sellerEmail || g.sellerPhone
          ? `\n  Liên hệ: ${[g.sellerEmail, g.sellerPhone].filter(Boolean).join(' · ')}`
          : ''
      return `• **${g.shop}** — ${items}${contact}`
    })
    .join('\n')
}

function resolveProductHits(ctx: ChatContext, raw: string): Product[] {
  if (ctx.enrichment?.searchResults?.length) return ctx.enrichment.searchResults
  if (ctx.enrichment?.categoryProducts?.length) return ctx.enrichment.categoryProducts
  if (ctx.enrichment?.product) return [ctx.enrichment.product]
  const filtered = filterProductsForQuery(ctx.products, raw, ctx.categories, 12)
  if (filtered.products.length) return filtered.products
  return findProductsByQuery(ctx.products, extractProductSearchTerms(raw) || stripPriceTokens(raw) || raw)
}

function whereToBuyReply(ctx: ChatContext, raw: string): string {
  const name = greet(ctx.userName ?? '')
  const hits = resolveProductHits(ctx, raw)
  if (!hits.length) {
    return `${name}Chưa tìm thấy shop bán đúng nhu cầu đó. Thử hỏi cụ thể hơn (vd: **"chỗ nào bán laptop"**, **"shop nào bán tai nghe"**) hoặc mở **Cửa hàng**.`
  }
  const directory = shopDirectoryLines(hits, 5)
  const label = matchCategoryFromText(raw, ctx.categories)?.name
  const topic = label ?? (stripPriceTokens(raw).slice(0, 40) || 'sản phẩm bạn hỏi')
  return `${name}**Chỗ bán — ${topic}:**\n${directory}\n\nMuốn email/SĐT thì hỏi **"liên hệ người bán …"** nhé.`
}

function recommendReply(ctx: ChatContext, raw: string): string {
  const name = greet(ctx.userName ?? '')
  const lower = normalizeText(raw)
  if (isAmbiguousShoppingQuery(lower)) {
    return discoveryReplyIntro(ctx.userName, 0, 'clarify')
  }
  if (asksProductDiscovery(lower)) {
    const pool = resolveProductHits(ctx, raw)
    const count = pool.length ? Math.min(pool.length, 6) : ctx.products.length ? Math.min(ctx.products.length, 6) : 0
    return discoveryReplyIntro(
      ctx.userName,
      count,
      isDiscoveryNewestQuery(lower) ? 'newest' : 'recommend',
      pool[0]?.name,
    )
  }
  if (ctx.recommendations.length) {
    const picks = ctx.recommendations
      .slice(0, 4)
      .map((r) => {
        const p = ctx.products.find((x) => x.id === r.productId)
        if (!p) return null
        const shop = p.shopName ? ` · shop **${p.shopName}**` : ''
        const why = (r.reasons?.length ? r.reasons : [r.reason]).slice(0, 2).join('; ')
        return `• **${p.name}** (${Math.round(r.score * 100)}/100)${shop}\n  → ${why}`
      })
      .filter(Boolean)
    if (picks.length) {
      return `${name}**Gợi ý DSS (có giải thích):**\n${picks.join('\n')}\n\nHỏi **"so sánh A và B"** hoặc **"chỗ nào bán …"**.`
    }
  }
  const pool = resolveProductHits(ctx, raw)
  const ranked = rankForUseCase(pool.length ? pool : ctx.products, raw, 6)
  if (!ranked.length) {
    return `${name}Chưa có gợi ý phù hợp — xem **Cửa hàng** hoặc hỏi danh mục (laptop, điện thoại…).`
  }
  const bundle = buildRecommendInsight(ctx, ranked)
  return formatRecommendInsightReply(ctx, bundle)
}

function purchaseOrdersForUser(ctx: ChatContext): Order[] {
  return ctx.purchaseOrders.length ? ctx.purchaseOrders : ctx.orders
}

function ordersReply(ctx: ChatContext, raw: string): string {
  const name = greet(ctx.userName ?? '')
  if (ctx.enrichment?.focusedOrder) {
    const focused = ctx.enrichment.focusedOrder
    const { spec } = parseOrderQuery(raw, ctx.enrichment?.orderQueryPrior)
    return presentOrdersReply([focused], { ...spec, detailLevel: 'detail' }, { userName: ctx.userName })
  }
  if (ctx.role === 'guest') {
    return `${name}Bạn cần **đăng nhập** để mình xem đơn hàng cá nhân. Sau đó hỏi lại "đơn hàng của tôi" nhé.`
  }
  const orders = purchaseOrdersForUser(ctx)
  const { spec } = parseOrderQuery(raw, ctx.enrichment?.orderQueryPrior)
  const filtered = filterOrdersBySpec(orders, spec)
  return presentOrdersReply(filtered, spec, { userName: ctx.userName })
}

function formatOrderSummary(orders: Order[], limit = 3): string {
  if (!orders.length) return 'Bạn chưa có đơn hàng nào. Hãy thêm sản phẩm vào giỏ và checkout.'
  return orders
    .slice(0, limit)
    .map((o) => {
      const items = o.items.map((i) => i.productName).slice(0, 2).join(', ')
      return `• #${o.id} — ${orderStatusLabel(o.status)} — ${formatVnd(o.total)} (${items || '—'})`
    })
    .join('\n')
}

function shopOverviewReply(ctx: ChatContext): string {
  const bundle = buildCatalogInsight(ctx)
  return formatCatalogInsightReply(ctx, bundle)
}

function categoriesReply(ctx: ChatContext): string {
  const bundle = buildCatalogInsight(ctx)
  const name = greet(ctx.userName ?? '')
  const topCats = ctx.categories.length
    ? ctx.categories
        .slice()
        .sort((a, b) => b.productCount - a.productCount)
        .slice(0, 4)
        .map((c) => c.name)
        .join(', ')
    : bundle.stats.topCategory ?? 'Điện thoại, Laptop, Thời trang'
  return `${name}${bundle.paragraphs[0] ?? 'Shop có nhiều danh mục để khám phá.'}\n\nCác nhóm chính: **${topCats}**. Hỏi vd: "laptop có gì", "dưới 2 triệu".`
}

function cartSummaryReply(ctx: ChatContext): string {
  const name = greet(ctx.userName ?? '')
  if (ctx.role === 'guest') {
    return `${name}**Đăng nhập** để xem giỏ hàng cá nhân. Demo: **customer@sedsp.vn** / **12345678**`
  }
  if (!ctx.cartLines.length) {
    return `${name}Giỏ hàng **trống**. Thêm SP từ **Cửa hàng** → **Thêm vào giỏ**.`
  }
  const lines = ctx.cartLines
    .slice(0, 6)
    .map((l) => `• ${l.productName} × **${l.quantity}** — ${formatVnd(l.subtotal)}`)
    .join('\n')
  return `${name}**Giỏ hàng** (${ctx.cartItemCount} món):\n${lines}\n\n**Tổng: ${formatVnd(ctx.cartTotal)}**\n→ **Giỏ hàng** · **Thanh toán**`
}

function orderDetailReply(ctx: ChatContext, raw = ''): string {
  const name = greet(ctx.userName ?? '')
  const focused = ctx.enrichment?.focusedOrder
  if (focused) {
    const { spec } = parseOrderQuery(raw || 'chi tiet don', ctx.enrichment?.orderQueryPrior)
    return presentOrdersReply([focused], { ...spec, detailLevel: 'detail' }, { userName: ctx.userName })
  }
  const orders = purchaseOrdersForUser(ctx)
  if (!orders.length) {
    return `${name}Chưa có đơn hàng. Đặt hàng qua **Giỏ hàng** → **Thanh toán**.`
  }
  const { spec } = parseOrderQuery(raw || 'don cuoi', ctx.enrichment?.orderQueryPrior)
  const filtered = filterOrdersBySpec(orders, { ...spec, latestOnly: true, timeRange: { type: 'recent', limit: 1 } })
  if (filtered.length) {
    return presentOrdersReply(filtered, { ...spec, detailLevel: 'detail', latestOnly: true }, { userName: ctx.userName })
  }
  return `${name}Hỏi kèm mã đơn, vd: "đơn #${orders[0].id}".`
}

function categoryBrowseReply(ctx: ChatContext, raw: string): string {
  const name = greet(ctx.userName ?? '')
  const fromApi = ctx.enrichment?.categoryProducts
  const matched = matchCategoryFromText(raw, ctx.categories)
  const cat = matched
    ? ctx.categories.find((c) => c.name === matched.name)
    : undefined
  const catalog = mergeCatalog(ctx)
  let products = fromApi?.length
    ? fromApi
    : cat
      ? filterProductsByCategory(catalog, cat.name, ctx.categories)
      : []
  if (!products.length && matched) {
    products = filterProductsByCategory(catalog, matched.name, ctx.categories)
  }
  if (!products.length) {
    products = findProductsByQuery(catalog, raw)
  }
  if (!products.length) {
    return `${name}Chưa thấy SP theo danh mục này. Bạn muốn thử danh mục khác hay lọc theo ngân sách?`
  }
  const label = cat?.name ?? products[0]?.category ?? 'Danh mục'
  const pick = products[0]?.name
  return pick
    ? `${name}**${label}** đang có vài lựa chọn ổn — mình nghiêng về **${pick}** trước nếu bạn chưa chốt tiêu chí.`
    : `${name}**${label}** đang có vài lựa chọn ổn.`
}

function productSearchReply(ctx: ChatContext, raw: string): string {
  const catalog = mergeCatalog(ctx)
  const policy = searchProductsWithPolicy(catalog, raw)
  return presentProductSearchResult(policy, ctx.userName)
}

function cheapestReply(ctx: ChatContext): string {
  const name = greet(ctx.userName ?? '')
  const list = cheapestProducts(ctx.products, 6)
  if (!list.length) {
    return `${name}Hiện chưa có sản phẩm để so sánh giá.`
  }
  const floor = formatVnd(list[0].price)
  if (list.length === 1) {
    return `${name}Nếu ưu tiên tiết kiệm thì **${list[0].name}** đang ở mức **${floor}**.`
  }
  return `${name}Mức thấp nhất khoảng **${floor}** — **${list[0].name}** là lựa chọn mềm nhất trong nhóm này.`
}

function mergeCatalog(ctx: ChatContext): Product[] {
  const map = new Map<string, Product>()
  for (const p of ctx.products) map.set(String(p.id), p)
  for (const p of ctx.enrichment?.searchResults ?? []) map.set(String(p.id), p)
  for (const p of ctx.enrichment?.categoryProducts ?? []) map.set(String(p.id), p)
  return [...map.values()]
}

function budgetReply(ctx: ChatContext, raw: string): string {
  const name = greet(ctx.userName ?? '')
  const catalog = mergeCatalog(ctx)
  const range = extractPriceRange(raw)
  if (range?.min != null && range?.max != null) {
    const hits = filterProductsForQuery(catalog, raw, ctx.categories, 6).products
    if (!hits.length) {
      return `${name}Trong khoảng **${formatVnd(range.min)} – ${formatVnd(range.max)}** mình chưa thấy mẫu khớp. Nới thêm một chút thường sẽ có nhiều lựa chọn hơn.`
    }
    const pick = hits[0]?.name
    return pick
      ? `${name}Tầm **${formatVnd(range.min)} – ${formatVnd(range.max)}** thì ổn — mình nghiêng về **${pick}** trước.`
      : `${name}Tầm **${formatVnd(range.min)} – ${formatVnd(range.max)}** có vài lựa chọn đáng xem.`
  }
  const budget = range?.max ?? extractBudgetVnd(raw)
  if (!budget) {
    if (isAffordableProductQuery(raw)) {
      const label = extractProductFocusLabel(raw)
      const hits = affordableProductsForQuery(catalog, raw, 6)
      if (hits.length) {
        const pick = hits[0]?.name
        return pick
          ? `${name}**${label}** giá dễ chịu thì có vài con khá ngon — mình nghiêng về **${pick}**.`
          : `${name}**${label}** giá dễ chịu thì có vài con khá ngon.`
      }
      return `${name}Chưa thấy **${label}** khớp trên shop. Thử từ khóa khác hoặc nới điều kiện?`
    }
    return `${name}Bạn muốn giữ budget khoảng bao nhiêu? Tầm giá sẽ giúp mình lọc chính xác hơn.`
  }
  const filtered = filterProductsForQuery(catalog, raw, ctx.categories, 6)
  const hits = filtered.products
  const label = extractProductFocusLabel(raw)
  if (!hits.length) {
    if (filtered.queryText) {
      return `${name}Trong tầm **${formatVnd(budget)}** mình chưa thấy **${label}** khớp. Bạn muốn nới budget thêm khoảng 300–500k hay giữ mức này?`
    }
    return `${name}Trong tầm **${formatVnd(budget)}** mình chưa thấy mẫu nào. Nới thêm một chút hoặc hỏi món rẻ nhất đang có nhé.`
  }
  const pick = hits[0]?.name
  if (filtered.queryText) {
    return pick
      ? `${name}Budget **${formatVnd(budget)}** cho **${label}** thì ổn — mình nghiêng về **${pick}** trước.`
      : `${name}Budget **${formatVnd(budget)}** thì có vài **${label}** đáng cân nhắc.`
  }
  return pick
    ? `${name}Budget này ổn áp — mình nghiêng về **${pick}** trước.`
    : `${name}Budget này ổn áp, có vài lựa chọn đáng xem.`
}

function contactSellerReply(ctx: ChatContext, raw: string): string {
  const name = greet(ctx.userName ?? '')
  const p = ctx.enrichment?.product ?? findProductsByQuery(ctx.products, raw)[0]
  if (!p) {
    return `${name}Bạn muốn liên hệ người bán sản phẩm nào? Hỏi cụ thể, vd: "lien he nguoi ban mon tai nghe bluetooth".`
  }
  return sellerShopSummaryReply(name, {
    shopName: p.shopName ?? 'SEDSP Official',
    shopLocation: p.shopLocation,
    productCount: 1,
    avgRating: p.rating > 0 ? p.rating : undefined,
    totalReviews: p.reviewCount,
    totalSold: p.soldCount,
    sellerEmail: p.sellerEmail,
    sellerPhone: p.sellerPhone,
    showContact: true,
    sellerId: p.sellerId,
    sampleProducts: [{ id: String(p.id), name: p.name }],
  }, p.name)
}

export function sellerShopSummaryReply(
  greetPrefix: string,
  seller: Pick<
    ChatSellerRef,
    | 'shopName'
    | 'shopLocation'
    | 'productCount'
    | 'avgRating'
    | 'totalReviews'
    | 'totalSold'
    | 'topCategories'
    | 'sellerEmail'
    | 'sellerPhone'
    | 'showContact'
    | 'sellerId'
    | 'sampleProducts'
  >,
  productName?: string,
): string {
  let block = `${greetPrefix}**Danh thiếp — ${seller.shopName}**`
  if (productName) block += `\n(Người bán **${productName}** bạn đang xem)`
  block += '\n'
  if (seller.shopLocation) block += `• Khu vực: **${seller.shopLocation}**\n`
  if (seller.productCount) {
    block += `• Đang bán: **${seller.productCount}** sản phẩm`
    if (seller.topCategories?.length) block += ` — ${seller.topCategories.join(', ')}`
    block += '\n'
  }
  if (seller.avgRating) {
    block += `• Rating TB: **${seller.avgRating}★**`
    if (seller.totalReviews) block += ` · **${seller.totalReviews}** lượt đánh giá`
    block += '\n'
  }
  if (seller.totalSold) block += `• Lượt bán ghi nhận: **${seller.totalSold}** (tổng SP trên sàn)\n`
  if (seller.showContact) {
    if (seller.sellerEmail) block += `• Email: **${seller.sellerEmail}**\n`
    if (seller.sellerPhone) block += `• SĐT: **${seller.sellerPhone}**\n`
  }
  block += `\n(Thông tin công khai cửa hàng — không gồm doanh thu nội bộ.)`
  return block
}

function contactEscalateReply(ctx: ChatContext, raw: string): string {
  return escalateReply(ctx, raw, 'explicit')
}

export function escalateReply(
  ctx: ChatContext,
  _raw: string,
  mode: 'unknown' | 'explicit' = 'unknown',
): string {
  return escalateReplyForRole(ctx, mode)
}

function complaintReply(ctx: ChatContext): string {
  const name = greet(ctx.userName ?? '')
  const orderHint =
    ctx.orders.length > 0
      ? `\nĐơn gần nhất: **#${ctx.orders[0].id}** — gửi kèm mã đơn khi liên hệ.`
      : ''
  return `${name}Rất tiếc về trải nghiệm của bạn. Mình ghi nhận và chuyển **ưu tiên** cho CSKH.\n\n**Liên hệ ngay:**\n• Email **customer@sedsp.vn** · menu **Liên hệ**\n• Quản lý: **manager@sedsp.vn** (khiếu nại nghiêm trọng)\n• Admin: **admin@sedsp.vn**${orderHint}\n\nMô tả thêm sự cố (mã đơn, tên SP) để xử lý nhanh hơn.`
}

function passwordReply(ctx: ChatContext): string {
  const name = greet(ctx.userName ?? '')
  return `${name}**Quên / đổi mật khẩu:**\n• Trang **Đăng nhập** → **Quên mật khẩu**\n• Nhập email — hệ thống gửi OTP qua mail (cấu hình MAIL_*)\n• Demo: mật khẩu chung **12345678** cho tài khoản seed\n\nVẫn lỗi? Email **admin@sedsp.vn**.`
}

function checkoutReply(ctx: ChatContext): string {
  const name = greet(ctx.userName ?? '')
  const loginNote = ctx.role === 'guest' ? '\n\n👉 **Đăng nhập** trước khi checkout.' : ''
  return `${name}**Cách đặt hàng:**\n1. Chọn SP → **Thêm vào giỏ**\n2. **Giỏ hàng** → kiểm tra số lượng\n3. **Thanh toán** → điền địa chỉ & chuyển **MoMo tới shop**\n4. Xác nhận — theo dõi tại **Đơn hàng của tôi**${loginNote}`
}

export function productReviewReply(
  ctx: ChatContext,
  raw: string,
  focusProduct?: Product,
): { text: string; reviewSummary: ChatReviewSummary } {
  const e = ctx.enrichment
  const p = focusProduct ?? e?.product ?? findProductsByQuery(ctx.products, raw)[0]
  if (!p) {
    const fallback: ChatReviewSummary = {
      productId: '',
      productName: 'Sản phẩm',
      averageRating: 0,
      totalReviews: 0,
      soldCount: 0,
      hasReviews: false,
      highlights: [],
    }
    return {
      text: `${greet(ctx.userName ?? '')}Hỏi tên SP cụ thể (vd: "tai nghe review") hoặc mở **chi tiết SP** → **Đánh giá**.`,
      reviewSummary: fallback,
    }
  }

  const reviewSummary = buildProductReviewSummary(p, e?.ratingSummary, e?.reviews ?? [])
  const text = buildReviewReplyText(reviewSummary, ctx.userName ?? undefined)
  return { text, reviewSummary }
}

export function productOriginReply(ctx: ChatContext, product: Product): string {
  const name = greet(ctx.userName ?? '')
  const origin = productOriginText(product)
  const listed = formatProductListedDate(product.createdAt)
  let block = `${name}**${product.name}**\n`
  block += origin
    ? `• Xuất xứ: **${origin}**`
    : `• Chưa ghi xuất xứ trên hệ thống — xem mô tả SP hoặc hỏi shop **${product.shopName ?? 'SEDSP'}**.`
  if (listed) block += `\n• Lên kệ từ: **${listed}**`
  block += `\n• Danh mục: **${product.category || '—'}** · Shop: **${product.shopName ?? 'SEDSP Official'}**`
  return block
}

export function productListedReply(ctx: ChatContext, product: Product): string {
  const name = greet(ctx.userName ?? '')
  const listed = formatProductListedDate(product.createdAt)
  if (listed) {
    return `${name}**${product.name}** lên kệ trên SEDSP từ **${listed}**.\n• Giá hiện tại: **${formatVnd(product.price)}** · Shop: **${product.shopName ?? 'SEDSP Official'}**`
  }
  return `${name}**${product.name}** đang được bán trên shop — ngày lên kệ chưa có trên hệ thống. Mở **/products/${product.id}** để xem chi tiết.`
}

function compareReply(ctx: ChatContext, raw: string): string {
  const name = greet(ctx.userName ?? '')
  const matched = findProductsByQuery(ctx.products, raw)
  if (matched.length >= 2) {
    const [a, b] = matched
    const cheaper = a.price <= b.price ? a : b
    const betterRated = a.rating >= b.rating ? a : b
    const hotter = a.soldCount >= b.soldCount ? a : b
    const pref = (id: string) => {
      const r = ctx.recommendations.find((x) => x.productId === id)
      return r ? Math.round(r.score * 100) : null
    }
    const score = (p: typeof a) =>
      Math.round(p.rating * 12 + Math.min(p.soldCount, 200) / 20 - p.price / 50_000_000)
    const pa = pref(a.id)
    const pb = pref(b.id)
    const lines = [
      `${name}**So sánh DSS (dữ liệu thật trên sàn):**`,
      `| | **${a.name}** | **${b.name}** |`,
      `|---|---|---|`,
      `| Giá | ${formatVnd(a.price)} | ${formatVnd(b.price)} |`,
      `| Rating | ${a.rating}★ | ${b.rating}★ |`,
      `| Đã bán | ${a.soldCount} | ${b.soldCount} |`,
      `| Tồn | ${a.stock ?? '—'} | ${b.stock ?? '—'} |`,
      `| Danh mục | ${a.category} | ${b.category} |`,
      `| Shop | ${a.shopName ?? 'SEDSP'} | ${b.shopName ?? 'SEDSP'} |`,
      `| Điểm DSS* | ${score(a)} | ${score(b)} |`,
    ]
    if (pa != null || pb != null) {
      lines.push(`| Khớp sở thích | ${pa != null ? `${pa}/100` : '—'} | ${pb != null ? `${pb}/100` : '—'} |`)
    }
    lines.push(
      '',
      `• Rẻ hơn: **${cheaper.name}**`,
      `• Rating cao hơn: **${betterRated.name}**`,
      `• Bán chạy hơn: **${hotter.name}**`,
      '',
      `*Điểm DSS = rating + phổ biến − phạt giá (không bịa số liệu).`,
      `Kéo 2 SP vào chat để so sánh tồn kho chi tiết hơn.`,
    )
    return lines.join('\n')
  }
  return `${name}Hãy nêu **2 sản phẩm** cần so sánh, vd: "so sánh tai nghe và loa bluetooth".`
}

function sellerRatingReply(ctx: ChatContext): string {
  const name = greet(ctx.userName ?? '')
  const dash = ctx.sellerDashboard
  if (dash?.averageRating != null) {
    let msg = `${name}**Rating shop:** **${dash.averageRating.toFixed(1)}★**`
    if (dash.totalReviews) msg += ` · ${dash.totalReviews} review`
    if (dash.ratingWarning) msg += `\n⚠ ${dash.ratingWarning}`
    return msg + `\n\nTrả lời review <24h · **Quản lý SP** · **Bảng doanh số**.`
  }
  const catalog = ctx.sellerProducts
  const avgSold = catalog.length
    ? catalog.reduce((s, p) => s + p.soldCount, 0) / catalog.length
    : 0
  return `${name}**Rating shop:** theo dõi review từng SP.\n• TB lượt bán/SP: **${avgSold.toFixed(0)}**\n\n**Bảng doanh số** & DSS seller.`
}

function productInfoReply(ctx: ChatContext, raw: string): string {
  const name = greet(ctx.userName ?? '')
  const lower = normalizeText(raw)
  const p = ctx.enrichment?.product ?? findProductsByQuery(ctx.products, raw)[0]
  if (p) {
    const inv = ctx.enrichment?.inventory
    const stock = inv ? inv.availableQuantity : p.stock
    const desc = p.description?.trim()
    if (asksProductOrigin(lower)) {
      return productOriginReply(ctx, p)
    }
    if (asksProductListedDate(lower)) {
      return productListedReply(ctx, p)
    }
    const usageFocus = /cong dung|dung lam|dung de|tinh nang|dac diem|mo ta|gioi thieu|la gi/.test(lower)
    if (usageFocus) {
      const useLine = desc
        ? desc.slice(0, 280) + (desc.length > 280 ? '…' : '')
        : `${p.name} thuộc danh mục **${p.category || 'sản phẩm'}** — xem trang SP để biết chi tiết công dụng.`
      return `${name}**${p.name}** — công dụng / mô tả:\n${useLine}\n\nGiá **${formatVnd(p.price)}** · tồn **${stock <= 0 ? 'hết hàng' : stock}** · shop **${p.shopName ?? 'SEDSP Official'}**.`
    }
    const descLine = desc
      ? desc.slice(0, 160) + (desc.length > 160 ? '…' : '')
      : 'Xem mô tả đầy đủ trên trang SP.'
    const meta = productMetadataLines(p)
    const img = p.imageUrl ? `\n• Ảnh: có (xem trang SP)` : ''
    return `${name}**${p.name}**\n• Danh mục: **${p.category}**\n• Giá: **${formatVnd(p.price)}**\n• Tồn: **${stock <= 0 ? 'hết hàng' : stock}**\n• Shop: **${p.shopName ?? 'SEDSP Official'}**${meta.length ? `\n${meta.join('\n')}` : ''}${img}\n• ${descLine}\n\n→ Chi tiết **/products/${p.id}**`
  }
  return `${name}Bạn muốn biết SP nào? Hỏi tên cụ thể, vd: "thong tin tai nghe bluetooth", hoặc kéo SP vào khung chat.`
}

function buildCustomerIntent(ctx: ChatContext, intent: ChatIntent, raw: string): string | null {
  const name = greet(ctx.userName ?? '')
  const lower = normalizeText(raw)

  switch (intent) {
    case 'shipping':
      return `${name}**Chính sách giao hàng SEDSP:**\n• Nội thành: 1–2 ngày\n• Ngoại tỉnh: 3–5 ngày\n• Miễn phí ship đơn từ **500.000₫**\n• Theo dõi tại **Đơn hàng của tôi** sau khi đặt.`
    case 'payment':
      return `${name}**Hình thức thanh toán:**\n• **Chuyển MoMo tới shop** — quét QR / chuyển khoản số điện thoại shop lúc checkout.\nGiá niêm yết chưa trừ voucher. Nhập mã giảm giá ở bước **Thanh toán**.`
    case 'orders':
      return ordersReply(ctx, raw)
    case 'order_detail':
      return orderDetailReply(ctx, raw)
    case 'order_cancel': {
      const cancellable = ctx.orders.filter((o) => o.status === 'pending' || o.status === 'confirmed')
      if (!cancellable.length) {
        return `${name}Không có đơn nào có thể hủy. Chỉ hủy khi **chờ xác nhận** hoặc **đã xác nhận** (chưa giao).`
      }
      return `${name}**${cancellable.length}** đơn có thể hủy:\n${formatOrderSummary(cancellable, 3)}\n\n**Chi tiết đơn** → **Hủy đơn**.`
    }
    case 'cart':
      return cartSummaryReply(ctx)
    case 'cart_summary':
      return cartSummaryReply(ctx)
    case 'recommend':
      return recommendReply(ctx, raw)
    case 'promo': {
      const vouchers = ctx.publicVouchers.slice(0, 6)
      if (vouchers.length) {
        const lines = vouchers.map((v) => {
          const off = v.discountType === 'PERCENTAGE' ? `${v.discountValue}%` : formatVnd(v.discountValue)
          const scope = v.sellerName ? `shop ${v.sellerName}` : 'toàn sàn'
          return `• **${v.code}** — giảm **${off}** (${scope})${v.description ? `: ${v.description}` : ''}`
        }).join('\n')
        return `${name}**Mã voucher đang hiệu lực:**\n${lines}\n\nNhập mã ở **Thanh toán**, hoặc chọn mã trên **trang chủ**. Giá sản phẩm không giảm sẵn trên trang chi tiết.`
      }
      return `${name}Chưa có voucher công khai — theo dõi trang chủ hoặc hỏi manager.`
    }
    case 'return_policy':
      return `${name}**Đổi trả & bảo hành:**\n• Đổi trả **7 ngày** nếu lỗi NSX / sai mô tả\n• Giữ hóa đơn & tem BH\n• **Liên hệ** hoặc **customer@sedsp.vn** kèm mã đơn`
    case 'account':
      return `${name}**Tài khoản:**\n• **Đăng ký** — email + mật khẩu\n• **Đăng nhập** — email đã đăng ký\n• Demo: **customer@sedsp.vn** / **12345678**`
    case 'product_stock': {
      const target = ctx.enrichment?.product ?? findProductsByQuery(ctx.products, raw)[0]
      const inv = ctx.enrichment?.inventory
      if (target) {
        const qty = inv?.availableQuantity ?? target.stock
        if (qty <= 0) {
          return `${name}**${target.name}** **hết hàng**. Danh mục **${target.category}** · shop **${target.shopName ?? 'SEDSP Official'}**.`
        }
        return `${name}**${target.name}** còn **${qty}** — **${formatVnd(target.price)}** · shop **${target.shopName ?? 'SEDSP Official'}**. Thêm giỏ trên trang chi tiết.`
      }
      break
    }
    case 'product_price': {
      if (isPriceStatsQuery(raw)) {
        const label = extractProductFocusLabel(raw)
        const matched = findProductsByQuery(ctx.products, raw)
        const stats = computeProductPriceStats(matched, label, 5)
        if (stats) {
          return (
            `${name}**Giá ${stats.label}** (theo **${stats.count}** SP):\n` +
            `• Trung bình **${formatVnd(stats.average)}**\n` +
            `• Thấp nhất **${formatVnd(stats.min)}** (${stats.cheapest.name})\n` +
            `• Cao nhất **${formatVnd(stats.max)}** (${stats.priciest.name})\n\n` +
            `**Gợi ý:**\n${productLines(stats.products)}`
          )
        }
      }
      const matched = findProductsByQuery(ctx.products, raw)
      if (matched.length) {
        return `${name}**Bảng giá:**\n${productLines(matched.slice(0, 5))}\n\nChi tiết tại **Cửa hàng**.`
      }
      break
    }
    default:
      break
  }

  if (intent === 'product_price' || intent === 'product_stock' || /gia|price|ton|stock/.test(lower)) {
    const matched = findProductsByQuery(ctx.products, raw)
    if (matched.length) {
      return `${name}**Liên quan:**\n${productLines(matched.slice(0, 4))}`
    }
  }

  return null
}

function buildSellerIntent(ctx: ChatContext, intent: ChatIntent, raw: string): string | null {
  const name = greet(ctx.userName ?? '')
  const catalog = ctx.sellerProducts
  const prior = ctx.enrichment?.sellerAnalyticsPrior

  const analyticsReply = buildSellerAnalyticsReply(ctx, intent, raw, prior)
  if (analyticsReply) return analyticsReply

  switch (intent) {
    case 'seller_business_health':
      return buildSellerAnalyticsReply(ctx, intent, raw, prior) ?? `${name}Chưa đủ dữ liệu dashboard — mở **Bảng doanh số** rồi hỏi lại.`
    case 'seller_profit':
      return buildSellerAnalyticsReply(ctx, intent, raw, prior) ?? `${name}Chưa tính được lợi nhuận — cần giá vốn trên SP.`
    case 'seller_dss_explain':
      return buildSellerAnalyticsReply(ctx, intent, raw, prior)
    case 'seller_revenue': {
      if (ctx.salesPerformance) {
        const spec = parseSellerBusinessQuery(raw, intent, prior)
        return presentRevenueReply(ctx.salesPerformance, spec, ctx.userName)
      }
      const est = catalog.reduce((s, p) => s + p.soldCount * p.price, 0)
      return `${name}Ước tính từ catalog khoảng **${formatVnd(est)}**. Khi có dữ liệu đơn thật thì mình soi sâu hơn được.`
    }
    case 'seller_inventory': {
      const dash = ctx.sellerDashboard
      if (dash?.lowStockProducts.length) {
        const lines = dash.lowStockProducts.slice(0, 6).map((p) => `• ${p.productName} — còn **${p.quantity}**`).join('\n')
        return `${name}Có vài SKU đang sát ngưỡng:\n${lines}\n\nBạn muốn mình gợi ý nhập thêm theo DSS tồn không?`
      }
      const low = catalog.filter((p) => p.stock > 0 && p.stock < 20).sort((a, b) => a.stock - b.stock)
      const out = catalog.filter((p) => p.stock <= 0)
      if (low.length || out.length) {
        let msg = `${name}**Cảnh báo tồn kho:**\n`
        if (low.length) msg += `Sắp hết:\n${productLines(low.slice(0, 4))}\n`
        if (out.length) msg += `\nHết hàng:\n${productLines(out.slice(0, 3))}\n`
        return msg + `\nBạn có thể mở **Quản lý SP** hoặc hỏi **"khuyến nghị tồn kho"**.`
      }
      if (ctx.sellerInsights.length) {
        const inv = ctx.sellerInsights.filter((i) => i.category === 'inventory').slice(0, 3)
        if (inv.length) {
          return `${name}**DSS tồn kho:**\n${inv.map((i) => `• ${i.title}: ${i.description}`).join('\n')}`
        }
      }
      return `${name}Tồn kho **ổn định**. Hỏi **"khuyến nghị tồn kho"** nếu muốn DSS tính ROP.`
    }
    case 'seller_pricing':
      return `${name}**Khuyến nghị giá (DSS)**:\n${ctx.enrichment?.dssBriefText ?? priceBrief(catalog)}`
    case 'seller_dss_demand':
      return `${name}**Dự báo nhu cầu (LightGBM)**:\n${ctx.enrichment?.dssBriefText ?? demandBrief(catalog)}`
    case 'seller_dss_price':
      return `${name}**Khuyến nghị giá**:\n${ctx.enrichment?.dssBriefText ?? priceBrief(catalog)}`
    case 'seller_dss_inventory':
      return `${name}**Khuyến nghị tồn kho**:\n${ctx.enrichment?.dssBriefText ?? inventoryDssBrief(catalog)}`
    case 'seller_whatif': {
      const pct = extractDiscountPct(raw, 10)
      return `${name}**What-if giảm giá ${pct}%**:\n${ctx.enrichment?.dssBriefText ?? sellerWhatIfBrief(pct)}`
    }
    case 'seller_purchase_orders': {
      const buys = ctx.purchaseOrders
      if (!buys.length) {
        return `${name}Bạn chưa có **đơn mua** (mua như khách). Thêm SP từ **Cửa hàng** → **Giỏ hàng** → **Thanh toán**. Đơn bán: hỏi **"đơn cần xử lý"**.`
      }
      return `${name}**Đơn mua của bạn** (${buys.length} đơn):\n${formatOrderSummary(buys, 5)}`
    }
    case 'seller_promo': {
      const highStock = catalog.filter((p) => p.stock > 25).slice(0, 2)
      const top = [...catalog].sort((a, b) => b.soldCount - a.soldCount)[0]
      return `${name}**Kế hoạch tuần:**\n• Flash sale SKU tồn cao${highStock.length ? `: ${highStock.map((p) => p.name).join(', ')}` : ''}\n• Bundle + ${top?.name ?? 'SP chủ lực'}\n• Mô phỏng: hỏi **"what-if giảm 10%"**\n• Trả review <24h`
    }
    case 'seller_add_product':
      return `${name}**Thêm SP:**\n1. **Quản lý SP** → **+ Thêm SP**\n2. Chọn danh mục VI (Điện thoại, Laptop, Nhà bếp…)\n3. Giá, tồn · upload **3 ảnh** (gallery)\n4. Lưu — hiện cửa hàng ngay.`
    case 'seller_orders': {
      if (ctx.orders.length) {
        return `${name}**${ctx.orders.length} đơn bán cần xử lý:**\n${formatOrderSummary(ctx.orders, 5)}\n\nĐơn mua của bạn: hỏi **"đơn mua của tôi"**.`
      }
      return `${name}Chưa có đơn bán. Khi có khách đặt, danh sách sẽ hiện tại **Quản lý đơn hàng**.`
    }
    case 'seller_recent_orders': {
      const recent = ctx.sellerDashboard?.recentOrders ?? []
      if (recent.length) {
        const lines = recent.slice(0, 5).map((o) => `• #${o.orderId} — ${o.customer} — ${formatVnd(o.total)} — ${o.status}`).join('\n')
        return `${name}**Đơn gần đây:**\n${lines}`
      }
      if (ctx.orders.length) {
        return `${name}**Đơn bán gần đây:**\n${formatOrderSummary(ctx.orders, 5)}`
      }
      return `${name}Chưa có đơn gần đây. Khi có đơn mới sẽ hiện ở đây và trang **Đơn bán**.`
    }
    case 'seller_top_products': {
      const bundle = buildSellerTopInsight(ctx, catalog)
      return formatSellerTopInsightReply(ctx, bundle)
    }
    case 'seller_rating':
      return sellerRatingReply(ctx)
    case 'orders':
      return buildSellerIntent(ctx, 'seller_orders', raw)
    case 'cart':
    case 'cart_summary':
      return cartSummaryReply(ctx)
    default:
      return null
  }
}

function buildManagerIntent(ctx: ChatContext, intent: ChatIntent, _raw: string): string | null {
  const name = greet(ctx.userName ?? '')
  const orders = ctx.orders
  const salesOrders = salesEligibleOrders(orders)
  const revenue = totalRevenue(orders)
  const pending = orders.filter((o) => o.status === 'pending').length
  const delivered = orders.filter((o) => o.status === 'delivered').length
  const aov = salesOrders.length ? revenue / salesOrders.length : 0
  const cancelled = orders.filter((o) => o.status === 'cancelled').length
  const cancelRate = orders.length ? ((cancelled / orders.length) * 100).toFixed(1) : '0'

  switch (intent) {
    case 'manager_kpi':
      return `${name}**KPI** (${salesOrders.length} đơn tính doanh số / ${orders.length} tổng):\n• Doanh thu: **${formatVnd(revenue)}**\n• AOV: **${formatVnd(aov)}**\n• Đã giao: **${delivered}**\n• Chờ xử lý: **${pending}**\n• Hủy: **${cancelRate}%**\n\nMở **Dashboard** (/manager/dashboard).`
    case 'manager_pending':
      if (!pending) return `${name}Không có đơn chờ — **ổn định**.`
      return `${name}**${pending} đơn chờ:**\n${formatOrderSummary(orders.filter((o) => o.status === 'pending').slice(0, 5), 5)}`
    case 'manager_segment': {
      const cats = new Map<string, number>()
      for (const o of salesOrders) {
        for (const item of o.items) {
          const p = ctx.products.find((x) => x.id === item.productId)
          cats.set(p?.category ?? 'Khác', (cats.get(p?.category ?? 'Khác') ?? 0) + item.quantity * item.unitPrice)
        }
      }
      const lines = [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, v]) => `• ${c}: ${formatVnd(v)}`).join('\n')
      return `${name}**Phân khúc doanh thu:**\n${lines || '• Chưa đủ dữ liệu'}\n\n**Phân tích**.`
    }
    case 'manager_whatif': {
      return `${name}**What-if giảm giá theo sản phẩm** thuộc module **Người bán** (API \`/api/dss/what-if/seller\`).\n\n• Manager: mở **Dashboard** (/manager/dashboard) — doanh thu sàn + Looker.\n• Seller: mở **/seller/dss/what-if** để mô phỏng % giảm giá / hòa vốn / lợi nhuận.\n\nGợi ý hỏi: "KPI tháng này", "đơn chờ", "doanh thu sàn".`
    }
    case 'manager_trend': {
      const cats = new Map<string, number>()
      for (const p of ctx.products) cats.set(p.category, (cats.get(p.category) ?? 0) + p.soldCount)
      const lines = [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, n]) => `• ${c}: ${n > 30 ? 'cao ↑' : 'ổn →'}`).join('\n')
      return `${name}**Xu hướng danh mục:**\n${lines}\n\n**Phân tích** + **DSS**.`
    }
    case 'manager_revenue':
      return `${name}Doanh thu **${formatVnd(revenue)}** / **${salesOrders.length}** đơn tính doanh số. AOV **${formatVnd(aov)}**.`
    case 'manager_insights': {
      if (ctx.managerInsights.length) {
        return `${name}**Insight sàn:**\n${ctx.managerInsights.slice(0, 5).map((i) => `• **${i.title}** (${i.impact}): ${i.description}`).join('\n')}\n\nMở **Dashboard** (/manager/dashboard).`
      }
      return `${name}Chưa có insights — xem **Dashboard** khi có thêm đơn hàng.`
    }
    default:
      return null
  }
}

function buildAdminIntent(ctx: ChatContext, intent: ChatIntent): string | null {
  const name = greet(ctx.userName ?? '')
  const users = ctx.users
  const active = users.filter((u) => u.active).length
  const byRole = (r: string) => users.filter((u) => u.role === r).length

  switch (intent) {
    case 'admin_system': {
      const metrics = ctx.systemMetrics
      if (metrics.length) {
        const lines = metrics.slice(0, 6).map((m) => {
          const icon = m.status === 'ok' ? '✓' : m.status === 'warn' ? '!' : '✗'
          return `• ${icon} ${m.name}: ${m.value}`
        }).join('\n')
        return `${name}**Hệ thống:**\n${lines}\n\n**Giám sát hệ thống**.`
      }
      return `${name}Spring Boot + PostgreSQL + Redis — **Giám sát hệ thống**.`
    }
    case 'admin_users':
      if (users.length) {
        return `${name}**Users** (${users.length}):\n• Active: **${active}**\n• Customer ${byRole('customer')} · Seller ${byRole('seller')} · Manager ${byRole('manager')} · Admin ${byRole('admin')}\n\n**Người dùng**.`
      }
      return `${name}RBAC tại **Người dùng**. Demo seed nhiều tài khoản (customer/seller/manager/admin).`
    case 'admin_security':
      return `${name}**Bảo mật:** JWT + RBAC · Error 1h **0.02%** · OAuth2 Google optional · Đổi JWT_SECRET production.`
    case 'admin_alerts': {
      const warns = ctx.systemMetrics.filter((m) => m.status === 'warn' || m.status === 'error')
      if (warns.length) {
        return `${name}**Cảnh báo:**\n${warns.map((m) => `• ${m.name}: ${m.value}`).join('\n')}\n\n**Giám sát**.`
      }
      return `${name}**Không cảnh báo nghiêm trọng.** Queue OK · Error **0.02%** · Backend online.`
    }
    case 'admin_config':
      return `${name}**Env (application.yml):** CLOUDINARY_* · MAIL_* · GOOGLE_CLIENT_* · JWT_SECRET`
    default:
      return null
  }
}

export function buildIntentReply(ctx: ChatContext, intent: ChatIntent, raw: string): string | null {
  const name = greet(ctx.userName ?? '')

  switch (intent) {
    case 'greeting':
      return `${name}Chào bạn! Mình hỗ trợ mua sắm SEDSP đây. ${roleHelpHints(ctx.role)}`
    case 'thanks':
      return `${name}Không có gì! Cần thêm cứ hỏi nhé.`
    case 'help':
      return `${name}**Tôi có thể giúp:**\n${roleHelpHints(ctx.role)}\n\nDùng **gợi ý nhanh** phía trên.`
    case 'platform': {
      if (ctx.role === 'seller') {
        return `${name}**SEDSP** hỗ trợ bạn **bán hàng**: doanh số, đơn bán, tồn kho, **DSS** (dự báo nhu cầu, gợi ý giá, what-if). Hỏi vd: "doanh thu tháng này", "SKU sắp hết".`
      }
      if (ctx.role === 'manager') {
        return `${name}**SEDSP** — quản lý sàn: KPI đơn, doanh thu, đơn chờ duyệt, insights DSS.`
      }
      return `${name}**SEDSP** là sàn mua sắm với catalog đa danh mục (điện thoại, laptop, thời trang…). Mình giúp bạn **tìm SP**, **so sánh giá**, **theo dõi đơn** & **đánh giá**. Hỏi vd: "laptop có gì", "dưới 2 triệu".`
    }
    case 'shop_overview':
      return shopOverviewReply(ctx)
    case 'categories':
      return categoriesReply(ctx)
    case 'contact_seller':
      return contactSellerReply(ctx, raw)
    case 'where_to_buy':
      return whereToBuyReply(ctx, raw)
    case 'recommend':
      return recommendReply(ctx, raw)
    case 'contact_escalate':
      return contactEscalateReply(ctx, raw)
    case 'complaint':
      return complaintReply(ctx)
    case 'password':
      return passwordReply(ctx)
    case 'checkout':
      return checkoutReply(ctx)
    case 'product_info':
      return productInfoReply(ctx, raw)
    case 'product_review':
      return productReviewReply(ctx, raw).text
    case 'compare':
      return compareReply(ctx, raw)
    case 'category_browse':
      return categoryBrowseReply(ctx, raw)
    case 'product_search':
      return productSearchReply(ctx, raw)
    case 'product_cheapest':
      return cheapestReply(ctx)
    case 'product_budget':
      return budgetReply(ctx, raw)
    case 'cart_summary':
      return cartSummaryReply(ctx)
    case 'order_detail':
      return orderDetailReply(ctx, raw)
    default:
      break
  }

  if (ctx.role === 'customer') return buildCustomerIntent(ctx, intent, raw)
  if (ctx.role === 'guest') {
    const base = buildCustomerIntent(ctx, intent, raw)
    if (base) {
      if (['orders', 'cart', 'recommend'].includes(intent)) {
        return base.replace(/của bạn/gi, 'sau khi đăng nhập') + '\n\n👉 **Đăng nhập** để xem đơn & giỏ cá nhân.'
      }
      if (intent === 'account') {
        return base + '\n\n👉 **Đăng nhập** role Khách hàng để mua & gợi ý AI.'
      }
      return base
    }
    if (intent === 'orders' || intent === 'cart') {
      return `${name}**Đăng nhập** (Khách hàng) để xem đơn, giỏ & gợi ý cá nhân. Demo: **customer@sedsp.vn** / **12345678**`
    }
    return null
  }
  if (ctx.role === 'seller') return buildSellerIntent(ctx, intent, raw)
  if (ctx.role === 'manager') return buildManagerIntent(ctx, intent, raw)
  if (ctx.role === 'admin') return buildAdminIntent(ctx, intent)

  return null
}
