import type { ChatContext } from '@/api/chat/context'
import type { ChatIntent } from '@/api/chat/intents'
import { formatVnd } from '@/api/chat/match'
import { orderStatusLabel } from '@/utils/orderStatus'
import { serializeVerifiedFacts, type VerifiedFacts } from '@/api/chat/verifiedFacts'

const ROLE_GUIDE: Record<string, string> = {
  customer:
    'Hỗ trợ khách mua sắm: tìm SP, chỉ đúng shop/seller bán hàng, giỏ, thanh toán (COD/VNPay), đơn, đổi trả. Link SP: /products/{id}.',
  guest: 'Tư vấn khách chưa đăng nhập: sản phẩm/danh mục, chỉ shop bán hàng, chính sách, đăng ký/đăng nhập.',
  seller:
    'Hỗ trợ người bán: doanh số, dashboard, tồn kho, top SP, đơn bán, DSS (nhu cầu/giá/tồn/what-if). Seller cũng mua như khách: giỏ + đơn mua (/orders).',
  manager:
    'Hỗ trợ quản lý: KPI đơn hàng, Doanh thu sàn / Looker Studio, insights DSS vận hành, xu hướng danh mục. What-if giảm giá theo SP thuộc seller (/seller/dss/what-if).',
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
    lines.push(`Catalog: ${ctx.products.length} SP trên sàn`)
    return lines.join('\n')
  }

  if (includeShopping && ctx.categories.length) {
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

  const catalog = ctx.sellerProducts.length ? ctx.sellerProducts : ctx.products
  if (includeShopping && catalog.length) {
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
      `Doanh số seller: ${formatVnd(s.totalRevenue)}, ${s.completedOrders} đơn, AOV ${formatVnd(s.averageOrderValue)}`,
    )
    for (const tp of ctx.salesPerformance.topProducts.slice(0, 4)) {
      lines.push(`- Top: ${tp.productName} (${tp.quantitySold} sp, ${formatVnd(tp.revenue)})`)
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

  return `Bạn là trợ lý mua sắm SEDSP — nói chuyện như nhân viên CSKH thật trên chat, thông minh và cụ thể.

NHIỆM VỤ: ${ROLE_GUIDE[ctx.role] ?? ROLE_GUIDE.customer}

CÁCH TRẢ LỜI (QUAN TRỌNG):
- Bạn nhận **SỰ THẬT ĐÃ XÁC MINH** từ hệ thống shop — đó là nguồn duy nhất cho giá, tồn, tên SP, đơn hàng.
- Nhiệm vụ của bạn: **viết lại tự nhiên, ấm, dễ hiểu** — KHÔNG thêm số liệu mới, KHÔNG đổi giá/tên SP.
- Nếu có "Bản tham chiếu đã kiểm tra": giữ **100% thông tin quan trọng**, chỉ làm mượt câu chữ.
- Thiếu dữ liệu trong SỰ THẬT → nói thẳng "mình chưa thấy … trên shop" + gợi ý Cửa hàng/Tìm kiếm — **cấm bịa**.
- Cấm mở đầu checklist platform khi user hỏi SP/giá/đơn.
- Cấm: "Theo quy định", "Hệ thống hỗ trợ", "Bạn muốn hỏi gì", "Mình có thể giúp gì", "tóm tắt bên dưới".
- 2–6 câu; xưng mình/bạn; **in đậm** giá, tên shop, tên SP khi hữu ích.
- Khi gợi ý sản phẩm: mở đầu ấm (vd. "Rất vui vì bạn đã hỏi", "Mình tìm được … gợi ý") — **cấm** "Kết quả cho …", "Kết quả tìm kiếm".
- Thanh toán: COD, VNPay, MoMo.
${intent === 'product_review' ? `
- User hỏi **đánh giá/review**: diễn giải tự nhiên (không chỉ lặp số); nếu <5 review thì nói rõ mẫu nhỏ; nhắc chênh lệch lượt mua/review nếu có trong SỰ THẬT; **cấm bịa** nội dung review không có trong facts; có thể tóm tắt điểm khen/chê từ review thật.` : ''}

CONTEXT SHOP:
${serializeContext(ctx, intent)}${factsBlock}`
}
