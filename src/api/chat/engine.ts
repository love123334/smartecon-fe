import type { ChatContext } from '@/api/chat/context'
import { detectIntent, type ChatIntent } from '@/api/chat/intents'
import { formatVnd, normalizeText } from '@/api/chat/match'
import { toChatProducts } from '@/api/chat/productCards'
import {
  cheapestProducts,
  extractBudgetVnd,
  extractPriceRange,
  filterProductsForQuery,
  findProductsByQuery,
  formatPriceRangeLabel,
  pickProductCatalog,
  productsUnderBudget,
} from '@/api/chat/products'
import {
  buildIntentReply,
  escalateReply,
  roleHelpHints,
} from '@/api/chat/responses'
import type { ChatProductRef, Product } from '@/types'

export { formatVnd, normalizeText } from '@/api/chat/match'

export interface AssistantReplyPayload {
  content: string
  products?: ChatProductRef[]
}

const SHOPPING_INTENTS = new Set<ChatIntent>([
  'product_budget',
  'product_search',
  'product_cheapest',
  'category_browse',
  'recommend',
  'promo',
  'compare',
  'product_info',
  'product_price',
  'product_stock',
  'product_review',
])

function greet(name: string): string {
  return name ? `${name}, ` : ''
}

function apiTag(ctx: ChatContext): string {
  if (ctx.dataSource === 'api') return ' (dữ liệu API)'
  if (ctx.dataSource === 'hybrid') return ' (API + demo)'
  return ''
}

function followUps(intent: ChatIntent | null, role: ChatContext['role']): string {
  const tips: Partial<Record<ChatIntent, string>> = {
    shop_overview: '\n\n👉 Thử: "điện thoại có gì" · "laptop có gì" · "sp rẻ nhất"',
    product_price: '\n\n👉 Thử: "còn hàng không" · "review" · "liên hệ người bán"',
    product_stock: '\n\n👉 Thử: "thêm vào giỏ" tại trang SP · "cách đặt hàng"',
    cart_summary: '\n\n👉 Tiếp: **Thanh toán** hoặc hỏi "chính sách giao hàng"',
    orders: '\n\n👉 Hỏi "chi tiết đơn #…" hoặc "hủy đơn"',
    contact_seller: '\n\n👉 Hoặc hỏi CSKH: "liên hệ hỗ trợ"',
    seller_dss_demand: '\n\n👉 Thử thêm: "khuyến nghị giá" · "what-if giảm 10%"',
    seller_whatif: '\n\n👉 Mở **/seller/dss/what-if** để chỉnh % và kỳ.',
    manager_whatif: '\n\n👉 Mở **/manager/dss/what-if** để so sánh scenario.',
    seller_purchase_orders: '\n\n👉 Đơn bán: hỏi "đơn cần xử lý". Giỏ: "giỏ hàng của tôi".',
    product_budget: '\n\n👉 Kéo SP vào chat để so sánh, hoặc hỏi "còn hàng không".',
    product_search: '\n\n👉 Thu hẹp thêm: "dưới 2 triệu" · kéo SP để hỏi chi tiết.',
  }
  if (intent && tips[intent]) return tips[intent]
  if (role === 'guest') return '\n\n👉 **Đăng nhập** để xem giỏ & đơn cá nhân.'
  return ''
}

function cardsIntro(
  ctx: ChatContext,
  title: string,
  count: number,
  extra?: string,
): string {
  const name = greet(ctx.userName ?? '')
  const hint = extra ? `\n${extra}` : ''
  return `${name}**${title}**${apiTag(ctx)} — **${count}** sản phẩm phù hợp.${hint}\n\nChọn card bên dưới để xem chi tiết.`
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
    if (found) out.push(found)
    else {
      out.push({
        id: a.id,
        name: a.name,
        description: '',
        price: a.price,
        originalPrice: a.originalPrice,
        stock: a.stock ?? 1,
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
          `${i + 1}. **${p.name}** — ${formatVnd(p.price)} · ${p.category || '—'} · ${p.stock <= 0 ? 'hết hàng' : `còn ${p.stock}`} · ${p.rating ? `${p.rating}★` : ''}`,
      )
      .join('\n')
    const cheapest = [...products].sort((a, b) => a.price - b.price)[0]
    return {
      content: `${name}**So sánh ${products.length} sản phẩm đã đính kèm**${apiTag(ctx)}:\n${lines}\n\n💡 Giá thấp nhất: **${cheapest.name}** (${formatVnd(cheapest.price)}).`,
      products: cards,
    }
  }

  const top = products[0]
  if (/gia|bao nhieu|how much|price/.test(lower)) {
    return {
      content: `${name}**${top.name}**: **${formatVnd(top.price)}**${top.originalPrice && top.originalPrice > top.price ? ` (gốc ${formatVnd(top.originalPrice)})` : ''}\n• Danh mục: ${top.category || '—'}\n• Tồn: ${top.stock <= 0 ? 'hết hàng' : top.stock}`,
      products: cards.slice(0, 1),
    }
  }
  if (/con hang|het hang|ton|stock/.test(lower)) {
    return {
      content: `${name}**${top.name}**: ${top.stock <= 0 ? '**hết hàng**' : `còn **${top.stock}**`}.`,
      products: cards.slice(0, 1),
    }
  }

  const desc = top.description?.trim()
  return {
    content: `${name}**${top.name}**${apiTag(ctx)}\n• Giá: **${formatVnd(top.price)}**\n• Danh mục: ${top.category || '—'}\n• Shop: ${top.shopName ?? 'SEDSP'}\n• Rating: ${top.rating ? `${top.rating}★` : '—'}${desc ? `\n• ${desc.slice(0, 160)}${desc.length > 160 ? '…' : ''}` : ''}\n\nHỏi thêm: giá · tồn · so sánh (kéo thêm SP).`,
    products: cards,
  }
}

function shoppingStructuredReply(
  ctx: ChatContext,
  raw: string,
  intent: ChatIntent | null,
): AssistantReplyPayload | null {
  const catalog = pickProductCatalog(ctx.products, ctx.sellerProducts, ctx.role)
  if (!catalog.length) return null

  const range = extractPriceRange(raw)
  const filter = filterProductsForQuery(catalog, raw, ctx.categories, 8)
  const isBuyerRole = ctx.role === 'customer' || ctx.role === 'guest'
  const wantsShop =
    Boolean(range) ||
    (intent != null && SHOPPING_INTENTS.has(intent)) ||
    (isBuyerRole && Boolean(filter.queryText && filter.products.length))

  if (!wantsShop) return null

  if (intent === 'product_cheapest' || (/re nhat|cheapest|gia thap nhat/.test(normalizeText(raw)) && !range)) {
    const cheap = cheapestProducts(catalog, 6)
    if (!cheap.length) return null
    return {
      content: cardsIntro(ctx, 'Gợi ý giá tốt nhất', cheap.length),
      products: toChatProducts(cheap, 6),
    }
  }

  if (filter.products.length) {
    const bits: string[] = []
    if (filter.categoryName) bits.push(`danh mục **${filter.categoryName}**`)
    if (filter.range) bits.push(`giá **${formatPriceRangeLabel(filter.range)}**`)
    if (filter.queryText) bits.push(`từ khóa “${filter.queryText}”`)
    const title =
      filter.range && filter.queryText
        ? 'SP khớp nhu cầu & ngân sách'
        : filter.range
          ? `SP trong tầm giá ${formatPriceRangeLabel(filter.range)}`
          : filter.categoryName
            ? filter.categoryName
            : 'Kết quả tìm kiếm'
    return {
      content: cardsIntro(
        ctx,
        title,
        filter.products.length,
        bits.length ? `Đã lọc: ${bits.join(' · ')}.` : undefined,
      ),
      products: toChatProducts(filter.products, 8),
    }
  }

  if (range) {
    return {
      content: `${greet(ctx.userName ?? '')}Không có SP trong khoảng **${formatPriceRangeLabel(range)}**${apiTag(ctx)}. Thử nới ngân sách hoặc hỏi "sp rẻ nhất".`,
    }
  }

  return null
}

function smartProductFallback(
  ctx: ChatContext,
  raw: string,
  matched: Product[],
): AssistantReplyPayload | null {
  if (!matched.length) return null
  const name = greet(ctx.userName ?? '')
  const lower = normalizeText(raw)
  const top = matched[0]
  const tag = apiTag(ctx)
  const cards = toChatProducts(matched, 4)

  if (/gia|bao nhieu|how much|price|cost|tien/.test(lower)) {
    return {
      content: `${name}**${top.name}**${tag}: **${formatVnd(top.price)}**${top.originalPrice && top.originalPrice > top.price ? ` (gốc ${formatVnd(top.originalPrice)})` : ''}\n• Danh mục: ${top.category}\n• Tồn: ${top.stock <= 0 ? 'hết hàng' : top.stock}`,
      products: cards,
    }
  }
  if (/con hang|het hang|ton|stock|available|con khong/.test(lower)) {
    return {
      content: `${name}**${top.name}**${tag}: ${top.stock <= 0 ? '**hết hàng**' : `còn **${top.stock}**`}. Shop **${top.shopName ?? 'SEDSP'}**.`,
      products: cards.slice(0, 1),
    }
  }
  if (/review|danh gia|sao|tot khong/.test(lower)) {
    return {
      content: `${name}**${top.name}** — rating **${top.rating}★**${top.reviewCount ? ` · ${top.reviewCount} đánh giá` : ''}.`,
      products: cards.slice(0, 1),
    }
  }
  if (/lien he|seller|nguoi ban|shop/.test(lower)) {
    return {
      content: `${name}Shop **${top.shopName ?? 'SEDSP Official'}** — ${top.name}\n• Email: **${top.sellerEmail ?? 'seller@sedsp.vn'}**\n• SĐT: **${top.sellerPhone ?? '1900-SEDSP'}**`,
      products: cards.slice(0, 1),
    }
  }

  return {
    content: cardsIntro(ctx, 'Sản phẩm liên quan', Math.min(matched.length, 4)),
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
    return { content: 'Bạn muốn hỏi gì? ' + roleHelpHints(ctx.role) }
  }

  const attached = attachmentReply(ctx, raw || 'cho tôi thông tin', attachments ?? [])
  if (attached && attachments?.length) {
    return {
      content: attached.content + followUps('compare', ctx.role),
      products: attached.products,
    }
  }

  const detected = detectIntent(raw, ctx.role)
  let intent = detected?.intent ?? null

  const budget = extractBudgetVnd(raw)
  const range = extractPriceRange(raw)
  if ((budget != null && budget > 0) || range) {
    if (!intent || intent === 'product_budget' || intent === 'promo' || intent === 'recommend' || intent === 'product_search') {
      intent = 'product_budget'
    }
  }

  const shopping = shoppingStructuredReply(ctx, raw, intent)
  if (shopping) {
    return {
      content: shopping.content + followUps(intent, ctx.role),
      products: shopping.products,
    }
  }

  if (intent) {
    const reply = buildIntentReply(ctx, intent, raw)
    if (reply) {
      // Bóc SP từ enrichment nếu có (không lặp bullet dài)
      const enrichProducts =
        ctx.enrichment?.searchResults?.length
          ? ctx.enrichment.searchResults
          : ctx.enrichment?.categoryProducts?.length
            ? ctx.enrichment.categoryProducts
            : ctx.enrichment?.product
              ? [ctx.enrichment.product]
              : undefined
      const products = enrichProducts?.length
        ? toChatProducts(enrichProducts, 6)
        : undefined
      let content = reply + followUps(intent, ctx.role)
      // Khi đã có card thì rút gọn phần bullet list SP trong text
      if (products?.length) {
        content = content.replace(/(?:\n• \*\*[^*]+\*\*[^\n]*)+/g, '').trim()
        if (!content.includes('card') && !content.includes('bên dưới')) {
          content += `\n\n**${products.length}** sản phẩm — xem card bên dưới.`
        }
      }
      return { content, products }
    }
  }

  const catalog = pickProductCatalog(ctx.products, ctx.sellerProducts, ctx.role)
  const searchHits = ctx.enrichment?.searchResults
  const matched = searchHits?.length ? searchHits : findProductsByQuery(catalog, raw)

  const smart = smartProductFallback(ctx, raw, matched)
  if (smart) {
    return {
      content: smart.content + followUps(null, ctx.role),
      products: smart.products,
    }
  }

  if (/re|gia thap|tiet kiem|cheap|affordable/.test(lower) && catalog.length) {
    const cheap = cheapestProducts(catalog, 4)
    if (cheap.length) {
      return {
        content: cardsIntro(ctx, 'Gợi ý giá tốt', cheap.length) + '\n\nHoặc hỏi "dưới 2 triệu".',
        products: toChatProducts(cheap, 4),
      }
    }
  }

  if (budget != null && catalog.length) {
    const hits = productsUnderBudget(catalog, budget, 6)
    if (hits.length) {
      return {
        content: cardsIntro(ctx, `SP ≤ ${formatVnd(budget)}`, hits.length),
        products: toChatProducts(hits, 6),
      }
    }
    return {
      content: `${greet(ctx.userName ?? '')}Không có SP trong ngân sách **${formatVnd(budget)}**. Thử mức cao hơn hoặc hỏi "sp rẻ nhất".`,
    }
  }

  if (/dang nhap|login|sign in/.test(lower) && ctx.role === 'guest') {
    return {
      content: `${greet(ctx.userName ?? '')}**Đăng nhập** role Khách hàng để mua hàng, xem đơn & gợi ý AI.\nDemo: **customer@sedsp.vn** / **12345678**`,
    }
  }

  return { content: escalateReply(ctx, raw, 'unknown') }
}

export function typingDelay(content: string): number {
  return Math.min(1800, Math.max(380, Math.floor(content.length * 8)))
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
