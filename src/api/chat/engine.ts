import type { ChatContext } from '@/api/chat/context'
import { detectIntent } from '@/api/chat/intents'
import { normalizeText } from '@/api/chat/match'
import { findProductsByQuery, pickProductCatalog } from '@/api/chat/products'
import {
  buildIntentReply,
  escalateReply,
  productLines,
  roleHelpHints,
} from '@/api/chat/responses'

export { formatVnd, normalizeText } from '@/api/chat/match'

function greet(name: string): string {
  return name ? `${name}, ` : ''
}

export async function generateAssistantReply(text: string, ctx: ChatContext): Promise<string> {
  const raw = text.trim()
  const lower = normalizeText(raw)

  if (!raw) {
    return 'Bạn muốn hỏi gì? ' + roleHelpHints(ctx.role)
  }

  const detected = detectIntent(raw, ctx.role)

  if (detected) {
    const reply = buildIntentReply(ctx, detected.intent, raw)
    if (reply) return reply
  }

  const catalog = pickProductCatalog(
    ctx.products,
    ctx.sellerProducts,
    ctx.role,
  )

  const searchHits = ctx.enrichment?.searchResults
  const matched = searchHits?.length
    ? searchHits
    : findProductsByQuery(catalog, raw)

  if (matched.length >= 1) {
    const name = greet(ctx.userName ?? '')
    const apiTag =
      ctx.dataSource === 'api' ? ' (dữ liệu API)' : ctx.dataSource === 'hybrid' ? ' (API + demo)' : ''
    if (ctx.role === 'guest') {
      return `${name}**Tìm thấy${apiTag}:**\n${productLines(matched)}\n\n**Cửa hàng** — đăng nhập để thêm giỏ.`
    }
    if (ctx.role === 'seller') {
      return `${name}**Sản phẩm shop${apiTag}:**\n${productLines(matched.slice(0, 5))}`
    }
    return `${name}**Liên quan câu hỏi${apiTag}:**\n${productLines(matched.slice(0, 4))}\n\n${ctx.role === 'customer' ? 'Thêm giỏ tại trang chi tiết.' : 'Xem **Cửa hàng**.'}`
  }

  if (/dang nhap|login|sign in/.test(lower) && ctx.role === 'guest') {
    return `${greet(ctx.userName ?? '')}**Đăng nhập** role Khách hàng để mua hàng, xem đơn & gợi ý AI. Demo: **customer@sedsp.vn** / **12345678**`
  }

  return escalateReply(ctx, raw, 'unknown')
}

export function typingDelay(content: string): number {
  return Math.min(2200, Math.max(450, Math.floor(content.length * 10)))
}

export function formatChatHtml(content: string): string {
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}
