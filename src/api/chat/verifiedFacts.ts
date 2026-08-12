import type { AssistantReplyPayload } from '@/api/chat/engine'
import type { ChatContext } from '@/api/chat/context'
import type { ChatIntent } from '@/api/chat/intents'
import { formatVnd } from '@/api/chat/match'
import type { ChatProductRef } from '@/types'

export interface VerifiedFacts {
  intent: ChatIntent | null
  intentScore: number
  /** Dòng sự thật ngắn — LLM bắt buộc bám theo */
  lines: string[]
  /** Tên SP được phép nhắc */
  allowedProductNames: string[]
  /** Giá (số VND) đã xác minh */
  verifiedPricesVnd: number[]
  /** Bản local đã kiểm tra — LLM viết lại tự nhiên, không đổi số liệu */
  localDraft: string
  /** Card sản phẩm kèm theo */
  products: ChatProductRef[]
}

const CARD_BOILERPLATE =
  /\n\nBấm card bên dưới.*$|\n\nChọn card bên dưới.*$|\n\nMuốn mình lọc.*$|\n\nCần check còn hàng.*$|\n\nThêm vào giỏ.*$|\n\nHỏi chi tiết đơn.*$|\n\nSẵn thì hỏi.*$|\n\nThu hẹp thêm.*$|\n\nKéo SP vào chat.*$|\n\nThêm "dưới X triệu".*$|\n\nĐăng nhập để xem.*$/g

function stripCardBoilerplate(text: string): string {
  return text.replace(CARD_BOILERPLATE, '').trim()
}

function collectProducts(
  local: AssistantReplyPayload,
  ctx: ChatContext,
): ChatProductRef[] {
  const fromLocal = local.products ?? []
  if (fromLocal.length) return fromLocal
  const focus = ctx.enrichment?.product
  if (focus) {
    return [
      {
        id: focus.id,
        name: focus.name,
        price: focus.price,
        originalPrice: focus.originalPrice,
        stock: focus.stock,
        category: focus.category,
        imageUrl: focus.imageUrl,
        shopName: focus.shopName,
        rating: focus.rating,
      },
    ]
  }
  return []
}

/** Trích số tiền VND từ text (đã format hoặc raw). */
export function extractVndNumbers(text: string): number[] {
  const out = new Set<number>()
  const formatted = text.match(/\d[\d.,]*\s*(?:₫|vnd|dong)/gi) ?? []
  for (const m of formatted) {
    const digits = m.replace(/[^\d]/g, '')
    const n = Number(digits)
    if (n >= 1_000) out.add(n)
  }
  const raw = text.match(/\b\d{1,3}(?:\.\d{3})+\b/g) ?? []
  for (const m of raw) {
    const n = Number(m.replace(/\./g, ''))
    if (n >= 1_000) out.add(n)
  }
  return [...out]
}

export function buildVerifiedFacts(
  ctx: ChatContext,
  intent: ChatIntent | null,
  intentScore: number,
  local: AssistantReplyPayload,
): VerifiedFacts {
  const products = collectProducts(local, ctx)
  const lines: string[] = []
  const allowedProductNames: string[] = []
  const verifiedPricesVnd: number[] = []

  if (intent) {
    lines.push(`Ý định phát hiện: ${intent} (độ tin cậy ${intentScore})`)
  }

  for (const p of products.slice(0, 6)) {
    allowedProductNames.push(p.name)
    const priceLine = `- **${p.name}**: ${formatVnd(p.price)}`
    const stock =
      typeof p.stock === 'number'
        ? p.stock <= 0
          ? ' · hết hàng'
          : ` · còn ${p.stock}`
        : ''
    const shop = p.shopName ? ` · shop **${p.shopName}**` : ''
    lines.push(`${priceLine}${stock}${shop}`)
    if (typeof p.price === 'number' && p.price > 0) {
      verifiedPricesVnd.push(p.price)
    }
  }

  const focus = ctx.enrichment?.product
  if (focus && !products.some((p) => String(p.id) === String(focus.id))) {
    allowedProductNames.push(focus.name)
    lines.push(
      `- SP focus: **${focus.name}** | ${formatVnd(focus.price)} | tồn ${focus.stock} | shop ${focus.shopName ?? 'SEDSP'}`,
    )
    verifiedPricesVnd.push(focus.price)
    if (focus.description?.trim()) {
      lines.push(`- Mô tả: ${focus.description.trim().slice(0, 200)}`)
    }
  }

  if (ctx.enrichment?.searchResults?.length && !products.length) {
    lines.push('Kết quả tìm kiếm:')
    for (const p of ctx.enrichment.searchResults.slice(0, 4)) {
      allowedProductNames.push(p.name)
      lines.push(`- ${p.name}: ${formatVnd(p.price)}`)
      verifiedPricesVnd.push(p.price)
    }
  }

  if (ctx.enrichment?.ratingSummary) {
    const r = ctx.enrichment.ratingSummary
    lines.push(`- Đánh giá: ${r.averageRating}★ / ${r.totalReviews} review`)
  }

  if (ctx.cartLines.length) {
    lines.push(`- Giỏ: ${ctx.cartItemCount} món, tổng ${formatVnd(ctx.cartTotal)}`)
  }

  if (ctx.orders.length) {
    const o = ctx.orders[0]
    lines.push(
      `- Đơn gần nhất: #${o.id} | ${formatVnd(o.total)} | ${o.items.map((i) => i.productName).join(', ')}`,
    )
  }

  for (const n of extractVndNumbers(local.content)) {
    if (!verifiedPricesVnd.includes(n)) verifiedPricesVnd.push(n)
  }

  const localDraft = stripCardBoilerplate(local.content)

  if (localDraft && !lines.some((l) => localDraft.includes(l.slice(0, 20)))) {
    lines.push(`- Tóm tắt local: ${localDraft.replace(/\n+/g, ' ').slice(0, 420)}`)
  }

  return {
    intent,
    intentScore,
    lines,
    allowedProductNames: [...new Set(allowedProductNames)],
    verifiedPricesVnd: [...new Set(verifiedPricesVnd)],
    localDraft,
    products,
  }
}

export function serializeVerifiedFacts(facts: VerifiedFacts): string {
  if (!facts.lines.length && !facts.localDraft) {
    return '(Chưa có số liệu xác minh — nếu thiếu thông tin, nói thẳng và gợi ý bước tiếp.)'
  }
  const parts = [...facts.lines]
  if (facts.localDraft) {
    parts.push('')
    parts.push('Bản tham chiếu đã kiểm tra (giữ đủ số liệu, viết lại tự nhiên):')
    parts.push(facts.localDraft)
  }
  return parts.join('\n')
}
