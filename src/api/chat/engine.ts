import type { ChatContext } from '@/api/chat/context'
import { detectIntent, type ChatIntent } from '@/api/chat/intents'
import { normalizeText } from '@/api/chat/match'
import {
  cheapestProducts,
  extractBudgetVnd,
  findProductsByQuery,
  pickProductCatalog,
  productsUnderBudget,
} from '@/api/chat/products'
import {
  buildIntentReply,
  escalateReply,
  productLines,
  roleHelpHints,
} from '@/api/chat/responses'
import { formatVnd } from '@/api/chat/match'

export { formatVnd, normalizeText } from '@/api/chat/match'

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
    shop_overview: '\n\n👉 Thử: "tai nghe giá bao nhiêu" · "điện tử có gì" · "sp rẻ nhất"',
    product_price: '\n\n👉 Thử: "còn hàng không" · "review" · "liên hệ người bán"',
    product_stock: '\n\n👉 Thử: "thêm vào giỏ" tại trang SP · "cách đặt hàng"',
    cart_summary: '\n\n👉 Tiếp: **Thanh toán** hoặc hỏi "chính sách giao hàng"',
    orders: '\n\n👉 Hỏi "chi tiết đơn #…" hoặc "hủy đơn"',
    contact_seller: '\n\n👉 Hoặc hỏi CSKH: "liên hệ hỗ trợ"',
  }
  if (intent && tips[intent]) return tips[intent]
  if (role === 'guest') return '\n\n👉 **Đăng nhập** để xem giỏ & đơn cá nhân.'
  return ''
}

/** Khi chưa khớp intent rõ nhưng đã nhận diện SP — trả lời theo ngữ cảnh câu hỏi */
function smartProductFallback(ctx: ChatContext, raw: string, matched: ReturnType<typeof findProductsByQuery>): string | null {
  if (!matched.length) return null
  const name = greet(ctx.userName ?? '')
  const lower = normalizeText(raw)
  const top = matched[0]
  const tag = apiTag(ctx)

  if (/gia|bao nhieu|how much|price|cost|tien/.test(lower)) {
    return `${name}**${top.name}**${tag}: **${formatVnd(top.price)}**${top.originalPrice && top.originalPrice > top.price ? ` (gốc ${formatVnd(top.originalPrice)})` : ''}\n• Danh mục: ${top.category}\n• Tồn: ${top.stock <= 0 ? 'hết hàng' : top.stock}\n\n${productLines(matched.slice(0, 3), 3)}`
  }
  if (/con hang|het hang|ton|stock|available|con khong/.test(lower)) {
    const qty = top.stock
    return `${name}**${top.name}**${tag}: ${qty <= 0 ? '**hết hàng**' : `còn **${qty}**`}. Shop **${top.shopName ?? 'SEDSP'}**.`
  }
  if (/review|danh gia|sao|tot khong/.test(lower)) {
    return `${name}**${top.name}** — rating hiển thị **${top.rating}★**${top.reviewCount ? ` · ${top.reviewCount} đánh giá` : ''}. Xem tab **Đánh giá** trên trang SP.`
  }
  if (/lien he|seller|nguoi ban|shop/.test(lower)) {
    return `${name}Shop **${top.shopName ?? 'SEDSP Official'}** — ${top.name}\n• Email: **${top.sellerEmail ?? 'seller@sedsp.vn'}**\n• SĐT: **${top.sellerPhone ?? '1900-SEDSP'}**`
  }

  return `${name}**Liên quan câu hỏi**${tag}:\n${productLines(matched.slice(0, 4), 4)}\n\nHỏi cụ thể: giá · tồn kho · review · liên hệ người bán.`
}

export async function generateAssistantReply(text: string, ctx: ChatContext): Promise<string> {
  const raw = text.trim()
  const lower = normalizeText(raw)

  if (!raw) {
    return 'Bạn muốn hỏi gì? ' + roleHelpHints(ctx.role)
  }

  const detected = detectIntent(raw, ctx.role)
  let intent = detected?.intent ?? null

  // Ngân sách: ưu tiên nếu parse được số
  const budget = extractBudgetVnd(raw)
  if (budget != null && budget > 0 && (!intent || intent === 'product_budget' || intent === 'promo' || intent === 'recommend')) {
    intent = 'product_budget'
  }

  if (intent) {
    const reply = buildIntentReply(ctx, intent, raw)
    if (reply) return reply + followUps(intent, ctx.role)
  }

  const catalog = pickProductCatalog(ctx.products, ctx.sellerProducts, ctx.role)
  const searchHits = ctx.enrichment?.searchResults
  const matched = searchHits?.length ? searchHits : findProductsByQuery(catalog, raw)

  const smart = smartProductFallback(ctx, raw, matched)
  if (smart) return smart + followUps(null, ctx.role)

  // Gợi ý rẻ nhất khi hỏi mơ hồ về giá
  if (/re|gia thap|tiet kiem|cheap|affordable/.test(lower) && catalog.length) {
    const cheap = cheapestProducts(catalog, 4)
    if (cheap.length) {
      return `${greet(ctx.userName ?? '')}**Gợi ý giá tốt**${apiTag(ctx)}:\n${productLines(cheap, 4)}\n\nHoặc hỏi "dưới 2 triệu".`
    }
  }

  if (budget != null && catalog.length) {
    const hits = productsUnderBudget(catalog, budget, 6)
    if (hits.length) {
      return `${greet(ctx.userName ?? '')}**SP ≤ ${formatVnd(budget)}**${apiTag(ctx)}:\n${productLines(hits, 6)}`
    }
    return `${greet(ctx.userName ?? '')}Không có SP trong ngân sách **${formatVnd(budget)}**. Thử mức cao hơn hoặc hỏi "sp rẻ nhất".`
  }

  if (/dang nhap|login|sign in/.test(lower) && ctx.role === 'guest') {
    return `${greet(ctx.userName ?? '')}**Đăng nhập** role Khách hàng để mua hàng, xem đơn & gợi ý AI.\nDemo: **customer@sedsp.vn** / **12345678**`
  }

  return escalateReply(ctx, raw, 'unknown')
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
}
