import type { ChatContext } from '@/api/chat/context'
import { formatVnd } from '@/api/chat/match'
import { orderStatusLabel } from '@/utils/orderStatus'

const ROLE_GUIDE: Record<string, string> = {
  customer:
    'Hỗ trợ khách mua sắm: catalog API, giỏ hàng, thanh toán, giao hàng, đơn hàng, gợi ý AI, đánh giá SP, đổi trả.',
  guest: 'Tư vấn khách chưa đăng nhập: sản phẩm/danh mục từ API, chính sách shop, đăng ký/đăng nhập.',
  seller:
    'Hỗ trợ người bán: doanh số API, dashboard, tồn kho, top SP, đơn gần đây, DSS insights, khuyến mãi.',
  manager: 'Hỗ trợ quản lý: KPI đơn hàng API, insights DSS, phân khúc, what-if, xu hướng.',
  admin: 'Hỗ trợ admin: users API, trạng thái hệ thống, RBAC, cảnh báo, cấu hình.',
}

function serializeContext(ctx: ChatContext): string {
  const lines: string[] = []
  lines.push(`Vai trò: ${ctx.role} | Catalog: ${ctx.catalogSource} | Backend online: ${ctx.backendOnline}`)
  if (ctx.userName) lines.push(`Tên: ${ctx.userName}`)

  if (ctx.categories.length) {
    lines.push(`Danh mục API (${ctx.categories.length}):`)
    for (const c of ctx.categories.slice(0, 10)) {
      lines.push(`- ${c.name}: ${c.productCount} SP`)
    }
  }

  if (ctx.cartLines.length) {
    lines.push(`Giỏ hàng (${ctx.cartItemCount} món, tổng ${formatVnd(ctx.cartTotal)}):`)
    for (const l of ctx.cartLines.slice(0, 6)) {
      lines.push(`- ${l.productName} x${l.quantity} = ${formatVnd(l.subtotal)}`)
    }
  }

  if (ctx.orders.length) {
    lines.push(`Đơn hàng (${ctx.orders.length}):`)
    for (const o of ctx.orders.slice(0, 8)) {
      lines.push(
        `- #${o.id} | ${orderStatusLabel(o.status)} | ${formatVnd(o.total)} | ${o.items.map((i) => i.productName).join(', ')}`,
      )
    }
  }

  if (ctx.recommendations.length) {
    lines.push('Gợi ý AI:')
    for (const r of ctx.recommendations.slice(0, 5)) {
      const p = ctx.products.find((x) => x.id === r.productId)
      if (p) lines.push(`- ${p.name} (${Math.round(r.score * 100)}%): ${r.reason}`)
    }
  }

  const catalog = ctx.sellerProducts.length ? ctx.sellerProducts : ctx.products
  if (catalog.length) {
    lines.push(`Sản phẩm (${catalog.length}):`)
    for (const p of catalog.slice(0, 12)) {
      lines.push(
        `- ${p.name} | ${p.category} | ${formatVnd(p.price)} | tồn ${p.stock} | shop ${p.shopName ?? 'SEDSP'}`,
      )
    }
  }

  if (ctx.salesPerformance) {
    const s = ctx.salesPerformance.summary
    lines.push(
      `Doanh số seller API: ${formatVnd(s.totalRevenue)}, ${s.completedOrders} đơn, AOV ${formatVnd(s.averageOrderValue)}`,
    )
    for (const tp of ctx.salesPerformance.topProducts.slice(0, 4)) {
      lines.push(`- Top: ${tp.productName} (${tp.quantitySold} sp, ${formatVnd(tp.revenue)})`)
    }
  }

  if (ctx.sellerDashboard) {
    const d = ctx.sellerDashboard
    if (d.lowStockProducts.length) {
      lines.push('Tồn kho thấp (dashboard API):')
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
    if (d.recommendations.length) {
      lines.push('Gợi ý dashboard: ' + d.recommendations.slice(0, 3).join(' | '))
    }
  }

  if (ctx.sellerInsights.length) {
    lines.push('DSS seller:')
    for (const i of ctx.sellerInsights.slice(0, 4)) {
      lines.push(`- ${i.title}: ${i.description}`)
    }
  }

  if (ctx.managerInsights.length) {
    lines.push('DSS manager:')
    for (const i of ctx.managerInsights.slice(0, 4)) {
      lines.push(`- ${i.title}: ${i.description}`)
    }
  }

  if (ctx.users.length) {
    const active = ctx.users.filter((u) => u.active).length
    lines.push(`Users API: ${ctx.users.length} tổng, ${active} active`)
  }

  if (ctx.systemMetrics.length) {
    lines.push('Hệ thống:')
    for (const m of ctx.systemMetrics.slice(0, 6)) {
      lines.push(`- ${m.name}: ${m.value} (${m.status})`)
    }
  }

  const e = ctx.enrichment
  if (e?.ratingSummary) {
    lines.push(`Review SP: ${e.ratingSummary.averageRating}★ / ${e.ratingSummary.totalReviews} đánh giá`)
  }
  if (e?.inventory) {
    lines.push(`Inventory SP: available ${e.inventory.availableQuantity}, reserved ${e.inventory.reservedQuantity}`)
  }

  return lines.join('\n')
}

export function buildSystemPrompt(ctx: ChatContext): string {
  return `Bạn là trợ lý AI của SEDSP (Smart E-Commerce Decision Support Platform).

NHIỆM VỤ: ${ROLE_GUIDE[ctx.role] ?? ROLE_GUIDE.customer}

QUY TẮC:
- Trả lời bằng tiếng Việt (hoặc tiếng Anh nếu user hỏi English), thân thiện, súc tích.
- Ưu tiên số liệu trong CONTEXT từ API backend; không bịa.
- Gợi ý module UI: Cửa hàng, Giỏ hàng, Đơn hàng, Gợi ý AI, DSS, Dashboard...
- Thiếu dữ liệu → hướng dẫn bước tiếp hoặc chuyển CSKH (customer@sedsp.vn, manager@sedsp.vn).
- Dùng **in đậm** cho số liệu quan trọng.

CONTEXT (API + mock):
${serializeContext(ctx)}`
}
