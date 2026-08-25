import { rolePromptBlock } from '@/api/chat/rolePolicy'
import type { ChatContext } from '@/api/chat/context'
import type { ChatIntent } from '@/api/chat/intents'
import { formatVnd } from '@/api/chat/match'
import { orderStatusLabel } from '@/utils/orderStatus'
import { serializeVerifiedFacts, type VerifiedFacts } from '@/api/chat/verifiedFacts'

const ROLE_GUIDE: Record<string, string> = {
  customer:
    'Tư vấn khách mua hàng: gợi ý & tìm SP chính xác, so sánh giá, voucher, giỏ/đơn cá nhân, đánh giá khách, giao hàng/đổi trả. Luôn tư vấn tự nhiên, thân thiện và hữu ích.',
  guest:
    'Tư vấn khách chưa đăng nhập: giới thiệu SP/danh mục, giá, shop, chính sách, đăng ký/đăng nhập. Nhắc đăng nhập khi hỏi đơn/giỏ cá nhân.',
  seller:
    'Bạn là Cố vấn Kinh doanh & DSS cho **shop đang đăng nhập**. Chỉ dùng số liệu shop này — cấm GMV/KPI toàn sàn hay shop khác. Hỏi tháng nào thì trả tháng đó, không lấy tháng có dữ liệu gần nhất thế chỗ.',
  manager:
    'Hỗ trợ quản lý: KPI đơn, doanh thu sàn, đơn chờ, insights DSS vận hành toàn nền tảng.',
  admin: 'Hỗ trợ admin: users, trạng thái hệ thống, RBAC, cảnh báo, cấu hình.',
}

const SHOPPING_INTENTS = new Set<ChatIntent>([
  'product_search',
  'product_budget',
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
  'where_to_buy',
  'recommend',
  'contact_seller',
])

const ORDER_INTENTS = new Set<ChatIntent>([
  'orders',
  'order_detail',
  'order_cancel',
  'cart',
  'cart_summary',
  'shipping',
  'checkout',
  'seller_orders',
  'seller_recent_orders',
  'seller_purchase_orders',
])

const SELLER_OPS_INTENTS = new Set<ChatIntent>([
  'seller_revenue',
  'seller_inventory',
  'seller_pricing',
  'seller_dss_demand',
  'seller_dss_price',
  'seller_dss_inventory',
  'seller_whatif',
  'seller_top_products',
  'seller_business_health',
  'seller_profit',
  'seller_dss_explain',
])

const MANAGER_INTENTS = new Set<ChatIntent>([
  'manager_kpi',
  'manager_pending',
  'manager_revenue',
])

const TRIVIAL_INTENTS = new Set<ChatIntent>(['greeting', 'thanks', 'help'])

function serializeContext(ctx: ChatContext, intent?: ChatIntent | null): string {
  const lines: string[] = []
  lines.push(`Vai trò: ${ctx.role}`)
  if (ctx.userName) lines.push(`Tên: ${ctx.userName}`)

  const includeAll = !intent || intent === 'platform'
  const includeShopping =
    includeAll || (intent != null && SHOPPING_INTENTS.has(intent))
  const includeOrders =
    includeAll || (intent != null && ORDER_INTENTS.has(intent))
  const includeSellerOps =
    includeAll || (intent != null && SELLER_OPS_INTENTS.has(intent))
  const includeManager =
    includeAll || (intent != null && MANAGER_INTENTS.has(intent))
  const minimal = intent != null && TRIVIAL_INTENTS.has(intent)

  if (minimal) {
    if (ctx.cartItemCount) {
      lines.push(`Giỏ: ${ctx.cartItemCount} món, ${formatVnd(ctx.cartTotal)}`)
    }
    if (ctx.role === 'seller') {
      lines.push(`Shop này: ${ctx.sellerProducts.length} SP (không dùng catalog toàn sàn)`)
    } else {
      lines.push(`Catalog: ${ctx.products.length} SP trên sàn`)
    }
    return lines.join('\n')
  }

  const sellerOpsOnly = ctx.role === 'seller' && includeSellerOps

  if (includeShopping && ctx.categories.length && !sellerOpsOnly) {
    lines.push(`Danh mục (${ctx.categories.length}):`)
    for (const c of ctx.categories.slice(0, 10)) {
      lines.push(`- ${c.name}: ${c.productCount} SP`)
    }
  }

  if (includeOrders && ctx.cartLines.length) {
    lines.push(`Giỏ hàng (${ctx.cartItemCount} món, tổng ${formatVnd(ctx.cartTotal)}):`)
    for (const l of ctx.cartLines.slice(0, 6)) {
      lines.push(`- ${l.productName} x${l.quantity} = ${formatVnd(l.subtotal)}`)
    }
  }

  if (includeOrders && ctx.orders.length) {
    const label = ctx.role === 'seller' ? 'Đơn bán' : 'Đơn hàng'
    lines.push(`${label} (${ctx.orders.length}):`)
    for (const o of ctx.orders.slice(0, 8)) {
      lines.push(
        `- #${o.id} | ${orderStatusLabel(o.status)} | ${formatVnd(o.total)} | ${o.items.map((i) => i.productName).join(', ')}`,
      )
    }
  }

  if (includeOrders && ctx.purchaseOrders.length && ctx.role === 'seller') {
    lines.push(`Đơn mua (seller-as-buyer) (${ctx.purchaseOrders.length}):`)
    for (const o of ctx.purchaseOrders.slice(0, 5)) {
      lines.push(`- #${o.id} | ${orderStatusLabel(o.status)} | ${formatVnd(o.total)}`)
    }
  }

  if (includeShopping && ctx.recommendations.length) {
    lines.push('Gợi ý AI:')
    for (const r of ctx.recommendations.slice(0, 5)) {
      const p = ctx.products.find((x) => x.id === r.productId)
      if (p) {
        lines.push(
          `- ${p.name} | shop ${p.shopName ?? 'SEDSP'} (${Math.round(r.score * 100)}%): ${r.reason}`,
        )
      }
    }
  }

  const catalog = sellerOpsOnly
    ? ctx.sellerProducts
    : ctx.role === 'seller' && ctx.sellerProducts.length && !includeShopping
      ? ctx.sellerProducts
      : ctx.products
  if (sellerOpsOnly && ctx.sellerProducts.length) {
    lines.push(`SP SHOP NÀY (${ctx.sellerProducts.length}) — cấm lấy SP/GMV toàn sàn:`)
    for (const p of ctx.sellerProducts.slice(0, 12)) {
      lines.push(
        `- ${p.name} | ${p.category} | ${formatVnd(p.price)} | tồn ${p.stock}`,
      )
    }
  } else if (includeShopping && catalog.length && !sellerOpsOnly) {
    lines.push(`Sản phẩm + seller (${catalog.length}):`)
    for (const p of catalog.slice(0, 12)) {
      lines.push(
        `- ${p.name} | ${p.category} | ${formatVnd(p.price)} | tồn ${p.stock} | shop ${p.shopName ?? 'SEDSP'}`,
      )
    }
  }

  if (includeSellerOps && ctx.salesPerformance) {
    const s = ctx.salesPerformance.summary
    lines.push(
      `Doanh số SHOP NÀY (không phải GMV sàn): ${formatVnd(s.totalRevenue)}, ${s.completedOrders} đơn, AOV ${formatVnd(s.averageOrderValue)}`,
    )
    lines.push('Doanh thu shop theo tháng:')
    for (const m of ctx.salesPerformance.monthlyRevenue.slice(-12)) {
      lines.push(`- ${m.label}: ${formatVnd(m.value)}`)
    }
    for (const tp of ctx.salesPerformance.topProducts.slice(0, 4)) {
      lines.push(`- Top shop: ${tp.productName} (${tp.quantitySold} sp, ${formatVnd(tp.revenue)})`)
    }
  }

  if (includeSellerOps && ctx.sellerDashboard) {
    const d = ctx.sellerDashboard
    if (d.lowStockProducts.length) {
      lines.push('Tồn kho thấp:')
      for (const p of d.lowStockProducts.slice(0, 6)) {
        lines.push(`- ${p.productName}: còn ${p.quantity}`)
      }
    }
    if (d.recentOrders.length) {
      lines.push('Đơn seller gần đây:')
      for (const o of d.recentOrders.slice(0, 4)) {
        lines.push(`- #${o.orderId} ${o.customer} ${formatVnd(o.total)} ${o.status}`)
      }
    }
  }

  if (includeSellerOps && ctx.sellerInsights.length) {
    lines.push('DSS seller:')
    for (const i of ctx.sellerInsights.slice(0, 4)) {
      lines.push(`- ${i.title}: ${i.description}`)
    }
  }

  if (includeManager && ctx.managerInsights.length) {
    lines.push('DSS manager:')
    for (const i of ctx.managerInsights.slice(0, 4)) {
      lines.push(`- ${i.title}: ${i.description}`)
    }
  }

  if (ctx.users.length) {
    const active = ctx.users.filter((u) => u.active).length
    lines.push(`Users: ${ctx.users.length} tổng, ${active} active`)
  }

  if (ctx.systemMetrics.length) {
    lines.push('Hệ thống:')
    for (const m of ctx.systemMetrics.slice(0, 6)) {
      lines.push(`- ${m.name}: ${m.value} (${m.status})`)
    }
  }

  const e = ctx.enrichment
  if (e?.product) {
    const p = e.product
    lines.push('=== SP ĐANG FOCUS (bắt buộc nhớ khi trả lời follow-up) ===')
    lines.push(
      `- Tên: ${p.name} | Danh mục: ${p.category || '—'} | Giá: ${formatVnd(p.price)} | Tồn: ${p.stock} | Shop: ${p.shopName ?? 'SEDSP'}`,
    )
    if (p.description?.trim()) {
      lines.push(`- Mô tả/công dụng: ${p.description.trim().slice(0, 360)}`)
    }
  }
  if (e?.searchResults?.length) {
    lines.push('Kết quả tìm kiếm gần nhất:')
    for (const p of e.searchResults.slice(0, 6)) {
      lines.push(`- ${p.name} | shop ${p.shopName ?? 'SEDSP'} | ${formatVnd(p.price)}`)
    }
  }
  if (e?.ratingSummary) {
    lines.push(`Review SP: ${e.ratingSummary.averageRating}★ / ${e.ratingSummary.totalReviews} đánh giá`)
  }
  if (e?.inventory) {
    lines.push(`Tồn SP: available ${e.inventory.availableQuantity}, reserved ${e.inventory.reservedQuantity}`)
  }

  return lines.join('\n')
}

export function buildSystemPrompt(
  ctx: ChatContext,
  intent?: ChatIntent | null,
  facts?: VerifiedFacts | null,
): string {
  const factsBlock = facts
    ? `\n\n=== SỰ THẬT ĐÃ XÁC MINH (BẮT BUỘC — không đổi giá/tồn/tên SP) ===\n${serializeVerifiedFacts(facts)}`
    : ''

  return `Bạn là trợ lý mua sắm SEDSP — nói chuyện như người bạn am hiểu shopping (và hỗ trợ seller khi đúng vai).

VAI TRÒ: ${rolePromptBlock(ctx.role)}

NHIỆM VỤ: ${ROLE_GUIDE[ctx.role] ?? ROLE_GUIDE.customer}

GIỌNG & CẤU TRÚC:
- Tự nhiên, thân thiện, ngắn (2–5 câu). Giữ ngữ cảnh (budget, SP vừa bàn) — không hỏi lại điều đã biết.
- Ưu tiên: [nhận xét ngắn] + [recommendation/insight] + [1 follow-up nếu thật sự cần].
- Cấm: greeting máy móc, nhắc lại nguyên văn yêu cầu, báo cáo kiểu database, tự giới thiệu mỗi tin.
- Đa dạng cách nói — không lặp cùng một khung câu mỗi lượt.
- Xưng mình/bạn; **in đậm** tên SP / giá khi hữu ích.

SỰ THẬT:
- Chỉ dùng **SỰ THẬT ĐÃ XÁC MINH** cho giá, tồn, tên SP, đơn — không bịa thông số/review.
- Có nhiều SP: phân biệt theo nhu cầu user ("mình nghiêng về…", "nếu ưu tiên X thì…").
- Không có SP: giải thích tự nhiên + một hướng tiếp (nới budget / bỏ điều kiện) — cấm "không tìm thấy sản phẩm phù hợp với yêu cầu".

UI (quan trọng):
- Frontend đã hiện product cards (ảnh, giá, rating, nút). Bạn **không** dẫn UI.
- Cấm: "mời xem bên dưới", "bấm card", "danh sách sản phẩm", "dưới đây là…", "mình tìm được N sản phẩm", "xem chi tiết bên dưới".
- Thanh toán: MoMo trực tiếp tới shop lúc checkout (không COD, không VNPay).
${intent === 'product_review' ? `
- User hỏi **đánh giá/review**: diễn giải tự nhiên; nếu <5 review thì nói rõ mẫu nhỏ; nhắc chênh lệch lượt mua/review nếu có trong SỰ THẬT; **cấm bịa** nội dung review.` : ''}

CONTEXT SHOP:
${serializeContext(ctx, intent)}${factsBlock}`
}
