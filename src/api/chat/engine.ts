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
  groupProductsByShop,
  pickProductCatalog,
  productsUnderBudget,
  rankRecommendedProducts,
} from '@/api/chat/products'
import {
  buildIntentReply,
  escalateReply,
  roleHelpHints,
  sanitizeChatReply,
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
  'promo',
  'compare',
  'product_info',
  'product_price',
  'product_stock',
  'product_review',
])

function greet(name: string): string {
  const n = name?.trim()
  // Bỏ qua handle kỹ thuật / username không phải tên hiển thị
  if (!n || n.length < 2) return ''
  if (/^[a-z0-9._-]+$/i.test(n) && !/\s/.test(n) && n.length < 24) return ''
  return `${n}, `
}

function stockPhrase(stock: number | undefined | null): string {
  if (stock == null || Number.isNaN(Number(stock))) return 'tồn chưa rõ'
  if (stock <= 0) return 'hết hàng'
  return `còn ${stock}`
}

function sellerHintFromProducts(products: Product[]): string {
  const groups = groupProductsByShop(products, 3, 1)
  if (!groups.length) return ''
  return `\nMột số shop đang bán: ${groups.map((g) => g.shop).join(', ')}.`
}

function wrapReply(payload: AssistantReplyPayload): AssistantReplyPayload {
  return { ...payload, content: sanitizeChatReply(payload.content) }
}

function followUps(intent: ChatIntent | null, role: ChatContext['role']): string {
  const tips: Partial<Record<ChatIntent, string>> = {
    shop_overview: '\n\nBạn có thể hỏi tiếp: điện thoại, laptop, hoặc sp rẻ nhất.',
    product_price: '\n\nMuốn biết thêm: còn hàng không, review, hoặc liên hệ người bán.',
    product_stock: '\n\nThêm vào giỏ trên trang sản phẩm, hoặc hỏi mình cách đặt hàng.',
    cart_summary: '\n\nSẵn sàng thì thanh toán, hoặc hỏi chính sách giao hàng.',
    orders: '\n\nHỏi chi tiết đơn #… hoặc hủy đơn nếu cần.',
    contact_seller: '\n\nHoặc gửi góp ý qua trang Liên hệ nếu cần Admin hỗ trợ.',
    where_to_buy: '\n\nHỏi "liên hệ người bán …" để lấy email/SĐT shop.',
    recommend: '\n\nHỏi "chỗ nào bán …" để xem đúng shop.',
    seller_dss_demand: '\n\nCó thể hỏi thêm: khuyến nghị giá, what-if giảm 10%.',
    seller_whatif: '\n\nMở DSS → What-if giảm giá để chỉnh % và kỳ.',
    manager_whatif: '\n\nWhat-if theo SP thuộc seller; Manager xem Dashboard.',
    seller_purchase_orders: '\n\nĐơn bán: hỏi "đơn cần xử lý". Giỏ: "giỏ hàng của tôi".',
    product_budget: '\n\nKéo SP vào chat để so sánh, hoặc hỏi còn hàng không.',
    product_search: '\n\nThu hẹp thêm bằng "dưới 2 triệu", hoặc kéo SP để hỏi chi tiết.',
  }
  if (intent && tips[intent]) return tips[intent]
  if (role === 'guest') return '\n\nĐăng nhập để xem giỏ hàng và đơn cá nhân nhé.'
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
  const soft =
    count <= 0
      ? `${name}Mình chưa thấy sản phẩm phù hợp.${hint}`
      : `${name}${title} — hiện có **${count}** lựa chọn.${hint}\n\nBấm card bên dưới nếu muốn xem chi tiết nhé.`
  return soft
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
  if (/gia|bao nhieu|how much|price/.test(lower)) {
    return {
      content: `${name}**${top.name}**: **${formatVnd(top.price)}**${top.originalPrice && top.originalPrice > top.price ? ` (gốc ${formatVnd(top.originalPrice)})` : ''}\n• Danh mục: ${top.category || '—'}\n• Tồn: ${stockPhrase(top.stock)}`,
      products: cards.slice(0, 1),
    }
  }
  if (/con hang|het hang|ton|stock/.test(lower)) {
    return {
      content: `${name}**${top.name}**: ${
        top.stock == null
          ? 'chưa lấy được tồn kho — thử lại hoặc mở trang SP.'
          : top.stock <= 0
            ? '**hết hàng**'
            : `còn **${top.stock}**`
      }.`,
      products: cards.slice(0, 1),
    }
  }

  const desc = top.description?.trim()
  return {
    content: `${name}**${top.name}**\n• Giá: **${formatVnd(top.price)}**\n• Danh mục: ${top.category || '—'}\n• Shop: ${top.shopName ?? 'SEDSP'}\n• Rating: ${top.rating ? `${top.rating}★` : '—'}${desc ? `\n• ${desc.slice(0, 160)}${desc.length > 160 ? '…' : ''}` : ''}\n\nHỏi thêm: giá · tồn · so sánh (kéo thêm SP).`,
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
      content: cardsIntro(ctx, 'Gợi ý giá tốt nhất', cheap.length) + sellerHintFromProducts(cheap),
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
    const shopBit = sellerHintFromProducts(filter.products)
    return {
      content: cardsIntro(
        ctx,
        title,
        filter.products.length,
        bits.length ? `Đã lọc theo ${bits.join(', ')}.` : undefined,
      ) + shopBit,
      products: toChatProducts(filter.products, 8),
    }
  }

  if (range) {
    return {
      content: `${greet(ctx.userName ?? '')}Không có SP trong khoảng **${formatPriceRangeLabel(range)}**. Thử nới ngân sách hoặc hỏi "sp rẻ nhất".`,
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
  const cards = toChatProducts(matched, 4)

  if (/gia|bao nhieu|how much|price|cost|tien/.test(lower)) {
    return {
      content: `${name}**${top.name}**: **${formatVnd(top.price)}**${top.originalPrice && top.originalPrice > top.price ? ` (gốc ${formatVnd(top.originalPrice)})` : ''}\n• Danh mục: ${top.category}\n• Shop: **${top.shopName ?? 'SEDSP Official'}**\n• Tồn: ${top.stock <= 0 ? 'hết hàng' : top.stock}`,
      products: cards,
    }
  }
  if (/con hang|het hang|ton|stock|available|con khong/.test(lower)) {
    return {
      content: `${name}**${top.name}**: ${top.stock <= 0 ? '**hết hàng**' : `còn **${top.stock}**`}. Shop **${top.shopName ?? 'SEDSP Official'}**.`,
      products: cards.slice(0, 1),
    }
  }
  if (/review|danh gia|sao|tot khong|ngon/.test(lower)) {
    return {
      content: `${name}**${top.name}** — rating **${top.rating}★**${top.reviewCount ? ` · ${top.reviewCount} đánh giá` : ''} · shop **${top.shopName ?? 'SEDSP Official'}**.`,
      products: cards.slice(0, 1),
    }
  }
  if (/lien he|seller|nguoi ban|shop|cho nao|o dau ban/.test(lower)) {
    return {
      content: `${name}Shop **${top.shopName ?? 'SEDSP Official'}** đang bán **${top.name}**\n• Email: **${top.sellerEmail ?? 'seller@sedsp.vn'}**\n• SĐT: **${top.sellerPhone ?? '1900-SEDSP'}**`,
      products: cards.slice(0, 1),
    }
  }

  return {
    content:
      cardsIntro(ctx, 'Sản phẩm liên quan', Math.min(matched.length, 4)) +
      sellerHintFromProducts(matched),
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
    return wrapReply({ content: 'Bạn muốn hỏi gì? ' + roleHelpHints(ctx.role) })
  }

  const attached = attachmentReply(ctx, raw || 'cho tôi thông tin', attachments ?? [])
  if (attached && attachments?.length) {
    return wrapReply({
      content: attached.content + followUps('compare', ctx.role),
      products: attached.products,
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
      })
    }
  }

  if (intent) {
    const reply = buildIntentReply(ctx, intent, raw)
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
      const products = enrichProducts?.length
        ? toChatProducts(enrichProducts, 6)
        : undefined
      let content = reply + followUps(intent, ctx.role)
      // Giữ directory shop cho where_to_buy / recommend — không xóa bullet
      if (
        products?.length &&
        intent !== 'where_to_buy' &&
        intent !== 'recommend' &&
        intent !== 'contact_seller'
      ) {
        content = content.replace(/(?:\n• \*\*[^*]+\*\*[^\n]*)+/g, '').trim()
        if (!content.includes('card') && !content.includes('bên dưới')) {
          content += `\n\n**${products.length}** sản phẩm — xem card bên dưới.`
        }
      } else if (products?.length && (intent === 'where_to_buy' || intent === 'recommend')) {
        content += `\n\nChọn card bên dưới để xem SP.`
      }
      return wrapReply({ content, products })
    }
  }

  const catalog = pickProductCatalog(ctx.products, ctx.sellerProducts, ctx.role)
  const searchHits = ctx.enrichment?.searchResults
  const matched = searchHits?.length ? searchHits : findProductsByQuery(catalog, raw)

  const smart = smartProductFallback(ctx, raw, matched)
  if (smart) {
    return wrapReply({
      content: smart.content + followUps(null, ctx.role),
      products: smart.products,
    })
  }

  if (/re|gia thap|tiet kiem|cheap|affordable/.test(lower) && catalog.length) {
    const cheap = cheapestProducts(catalog, 4)
    if (cheap.length) {
      return wrapReply({
        content:
          cardsIntro(ctx, 'Gợi ý giá tốt', cheap.length) +
          sellerHintFromProducts(cheap) +
          '\n\nHoặc hỏi "dưới 2 triệu".',
        products: toChatProducts(cheap, 4),
      })
    }
  }

  if (budget != null && catalog.length) {
    const hits = productsUnderBudget(catalog, budget, 6)
    if (hits.length) {
      return wrapReply({
        content: cardsIntro(ctx, `SP ≤ ${formatVnd(budget)}`, hits.length) + sellerHintFromProducts(hits),
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
  // Snappier chat UX — still feels intentional, not sluggish
  return Math.min(900, Math.max(180, Math.floor(content.length * 4)))
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
