import type { AssistantReplyPayload } from '@/api/chat/engine'
import type { ChatContext } from '@/api/chat/context'
import type { ChatIntent } from '@/api/chat/intents'
import {
  buildCatalogInsight,
  buildRecommendInsight,
  buildSellerTopInsight,
  serializeInsightsForFacts,
  type CatalogInsightBundle,
} from '@/api/chat/insightEngine'
import { formatVnd } from '@/api/chat/match'
import { parseOrderQuery, presentOrdersFacts } from '@/api/chat/orderQuery'
import { parseSellerBusinessQuery, presentSellerAnalyticsFacts } from '@/api/chat/sellerAnalytics'
import { pickRepresentativeReviews } from '@/api/chat/productReviewSummary'
import type { ChatProductRef, ChatSellerRef } from '@/types'
import { orderStatusLabel } from '@/utils/orderStatus'

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
  /** Danh thiếp shop kèm theo */
  sellers: ChatSellerRef[]
  /** Insight engine — fact/derived/opinion tách bạch */
  insights?: CatalogInsightBundle
}

const CARD_BOILERPLATE =
  /\n\n(?:→\s*)?(?:Bấm|Chọn|Xem)(?:\s+chi tiết)?(?:\s+trên)?(?:\s+từng)?(?:\s+card|\s+\*\*danh thiếp shop\*\*)?(?:\s+bên dưới).*?$|\n\nMuốn mình lọc.*$|\n\nCần check còn hàng.*$|\n\nThêm vào giỏ.*$|\n\nHỏi chi tiết đơn.*$|\n\nSẵn thì hỏi.*$|\n\nThu hẹp thêm.*$|\n\nKéo SP vào chat.*$|\n\nThêm "dưới X triệu".*$|\n\nĐăng nhập để xem.*$|\n\n👉\s*Xem\s+\*\*danh thiếp shop\*\*.*$/gim

function stripCardBoilerplate(text: string): string {
  return text
    .replace(CARD_BOILERPLATE, '')
    .replace(/\s*—\s*xem thử bên dưới nhé\.?/gi, '.')
    .replace(/\s*xem thử bên dưới nhé\.?/gi, '')
    .trim()
}

/** Khối grounding cho LLM — structured facts, không phải bản nháp template. */
export function buildLlmGroundingBlock(facts: VerifiedFacts): string {
  const lines = facts.lines.filter((l) => !l.startsWith('- Tóm tắt local:')).slice(0, 14)
  if (!lines.length && !facts.products.length) return ''
  const productBits = facts.products.slice(0, 5).map((p) => {
    const rating = p.rating ? ` · ${p.rating}★` : ''
    const stock =
      typeof p.stock === 'number' ? (p.stock <= 0 ? ' · hết hàng' : ` · còn ${p.stock}`) : ''
    return `- ${p.name}: ${formatVnd(p.price)}${rating}${stock}${p.shopName ? ` · ${p.shopName}` : ''}`
  })
  const body = [...lines, ...(productBits.length && !lines.some((l) => l.includes(facts.products[0]?.name ?? '')) ? productBits : [])]
    .filter(Boolean)
    .join('\n')
  return `[CONTEXT SẢN PHẨM/SHOP — UI sẽ hiện card riêng; bạn chỉ nhận xét tự nhiên, không nhắc "bên dưới"/"card"]
${body || '(không có SP khớp — gợi ý nới điều kiện nếu hợp lý)'}`
}

function collectProducts(
  local: AssistantReplyPayload,
  ctx: ChatContext,
  intent: ChatIntent | null,
): ChatProductRef[] {
  if (intent === 'promo') return []
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

function collectSellers(local: AssistantReplyPayload): ChatSellerRef[] {
  return local.sellers ?? []
}

export function buildVerifiedFacts(
  ctx: ChatContext,
  intent: ChatIntent | null,
  intentScore: number,
  local: AssistantReplyPayload,
  userMessage?: string,
): VerifiedFacts {
  const products = collectProducts(local, ctx, intent)
  const sellers = collectSellers(local)
  const lines: string[] = []
  const allowedProductNames: string[] = []
  const verifiedPricesVnd: number[] = []

  if (intent) {
    lines.push(`Ý định phát hiện: ${intent} (độ tin cậy ${intentScore})`)
  }

  for (const p of products.slice(0, 5)) {
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

  for (const s of sellers.slice(0, 4)) {
    lines.push(
      `- Shop **${s.shopName}**: ${s.productCount ?? '—'} SP` +
        (s.avgRating ? ` · ${s.avgRating}★` : '') +
        (s.totalSold ? ` · ${s.totalSold} đã bán` : '') +
        (s.showContact && s.sellerEmail ? ` · ${s.sellerEmail}` : ''),
    )
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
    lines.push(`- Đánh giá TB: ${r.averageRating}★ / ${r.totalReviews} lượt`)
  }

  const focusDetail = ctx.enrichment?.product
  if (focusDetail?.soldCount) {
    lines.push(`- Đã bán: ${focusDetail.soldCount} lượt`)
  }
  if (focusDetail) {
    const origin =
      focusDetail.attributes?.find((a) =>
        /xuat xu|origin|made in|nguon goc/i.test(a.name),
      )?.value ?? focusDetail.shopLocation
    if (origin?.trim()) lines.push(`- Xuất xứ: ${origin.trim()}`)
    if (focusDetail.createdAt) {
      const listed = new Date(focusDetail.createdAt)
      if (!Number.isNaN(listed.getTime())) {
        lines.push(`- Lên kệ: ${listed.toLocaleDateString('vi-VN')}`)
      }
    }
    if (typeof focusDetail.reviewCount === 'number' && focusDetail.reviewCount > 0) {
      lines.push(`- Số review: ${focusDetail.reviewCount}`)
    }
  }

  if (ctx.enrichment?.reviews?.length) {
    for (const r of pickRepresentativeReviews(ctx.enrichment.reviews, 2)) {
      lines.push(`- Review ${r.userName}: ${r.rating}★ — ${r.comment.slice(0, 80)}`)
    }
  }

  if (intent === 'product_review') {
    const tr = ctx.enrichment?.ratingSummary?.totalReviews ?? focusDetail?.reviewCount ?? 0
    const sold = focusDetail?.soldCount ?? 0
    if (tr > 0 && tr < 5) {
      lines.push(
        `- Lưu ý DSS: chỉ ${tr} review — diễn giải thận trọng, không overclaim "mọi người"`,
      )
    }
    if (sold > tr * 8 && sold >= 30) {
      lines.push(
        `- ${sold.toLocaleString('vi-VN')} lượt mua vs ${tr} review — nên nhắc chênh lệch nếu liên quan`,
      )
    }
  }

  if (ctx.cartLines.length) {
    lines.push(`- Giỏ: ${ctx.cartItemCount} món, tổng ${formatVnd(ctx.cartTotal)}`)
  }

  if (intent === 'promo') {
    const vouchers = ctx.publicVouchers.slice(0, 6)
    if (vouchers.length) {
      lines.push('Voucher công khai:')
      for (const v of vouchers) {
        const off =
          v.discountType === 'PERCENTAGE' ? `${v.discountValue}%` : formatVnd(v.discountValue)
        lines.push(`- ${v.code}: giảm ${off}${v.description ? ` — ${v.description}` : ''}`)
      }
    } else {
      lines.push('- Không có voucher công khai đang hiệu lực')
    }
  }

  if (ctx.orders.length && (intent === 'orders' || intent === 'order_detail') && userMessage) {
    const purchaseOrders = ctx.purchaseOrders.length ? ctx.purchaseOrders : ctx.orders
    const { spec } = parseOrderQuery(userMessage, ctx.enrichment?.orderQueryPrior)
    lines.push(`- ${presentOrdersFacts(purchaseOrders, spec)}`)
  } else if (ctx.orders.length) {
    const o = ctx.orders[0]
    lines.push(
      `- Đơn gần nhất: #${o.id} | ${orderStatusLabel(o.status)} | ${formatVnd(o.total)}`,
    )
  }

  if (
    intent?.startsWith('seller_') &&
    userMessage &&
    ctx.role === 'seller'
  ) {
    const spec = parseSellerBusinessQuery(userMessage, intent, ctx.enrichment?.sellerAnalyticsPrior)
    const fact = presentSellerAnalyticsFacts(ctx, spec)
    if (fact) lines.push(`- ${fact}`)
    if (ctx.enrichment?.dssBriefText) {
      lines.push(`- DSS: ${ctx.enrichment.dssBriefText.replace(/\n+/g, ' ').slice(0, 280)}`)
    }
    if (ctx.salesPerformance && !fact.includes('Doanh thu')) {
      lines.push(
        `- Doanh thu API: ${formatVnd(ctx.salesPerformance.summary.totalRevenue)} · ${ctx.salesPerformance.summary.completedOrders} đơn HT`,
      )
    }
  }

  for (const n of extractVndNumbers(local.content)) {
    if (!verifiedPricesVnd.includes(n)) verifiedPricesVnd.push(n)
  }

  let insights: CatalogInsightBundle | undefined
  if (intent === 'shop_overview' || intent === 'categories') {
    insights = buildCatalogInsight(ctx)
  } else if (intent === 'recommend' && ctx.products.length) {
    insights = buildRecommendInsight(ctx, ctx.products.slice(0, 6))
  } else if (intent === 'seller_top_products') {
    const catalog = ctx.sellerProducts
    insights = buildSellerTopInsight(ctx, catalog)
  }
  if (insights) {
    lines.push(...serializeInsightsForFacts(insights))
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
    sellers,
    insights,
  }
}

export function serializeVerifiedFacts(facts: VerifiedFacts): string {
  const lines = facts.lines.filter((l) => !l.startsWith('- Tóm tắt local:'))
  if (!lines.length && !facts.products.length) {
    return '(Chưa có số liệu xác minh — nếu thiếu thông tin, nói thẳng và gợi ý bước tiếp.)'
  }
  return lines.join('\n')
}
