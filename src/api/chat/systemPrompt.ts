import type { ChatContext } from '@/api/chat/context'
import { formatVnd } from '@/api/chat/match'
import { orderStatusLabel } from '@/utils/orderStatus'

const ROLE_GUIDE: Record<string, string> = {
  customer:
    'Hỗ trợ khách mua sắm: tìm SP, chỉ đúng shop/seller bán hàng, giỏ, thanh toán (COD/VNPay), đơn, đổi trả. Link SP: /products/{id}.',
  guest: 'Tư vấn khách chưa đăng nhập: sản phẩm/danh mục, chỉ shop bán hàng, chính sách, đăng ký/đăng nhập.',
  seller:
    'Hỗ trợ người bán: doanh số, dashboard, tồn kho, top SP, đơn bán, DSS (nhu cầu/giá/tồn/what-if). Seller cũng mua như khách: giỏ + đơn mua (/orders).',
  manager:
    'Hỗ trợ quản lý: KPI đơn hàng, insights DSS, phân khúc, what-if khuyến mãi (/manager/dss/what-if), xu hướng danh mục.',
  admin: 'Hỗ trợ admin: users, trạng thái hệ thống, RBAC, cảnh báo, cấu hình.',
}

function serializeContext(ctx: ChatContext): string {
  const lines: string[] = []
  lines.push(`Vai trò: ${ctx.role}`)
  if (ctx.userName) lines.push(`Tên: ${ctx.userName}`)

  if (ctx.categories.length) {
    lines.push(`Danh mục (${ctx.categories.length}):`)
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
    const label = ctx.role === 'seller' ? 'Đơn bán' : 'Đơn hàng'
    lines.push(`${label} (${ctx.orders.length}):`)
    for (const o of ctx.orders.slice(0, 8)) {
      lines.push(
        `- #${o.id} | ${orderStatusLabel(o.status)} | ${formatVnd(o.total)} | ${o.items.map((i) => i.productName).join(', ')}`,
      )
    }
  }

  if (ctx.purchaseOrders.length && ctx.role === 'seller') {
    lines.push(`Đơn mua (seller-as-buyer) (${ctx.purchaseOrders.length}):`)
    for (const o of ctx.purchaseOrders.slice(0, 5)) {
      lines.push(`- #${o.id} | ${orderStatusLabel(o.status)} | ${formatVnd(o.total)}`)
    }
  }

  if (ctx.recommendations.length) {
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
  if (catalog.length) {
    lines.push(`Sản phẩm + seller (${catalog.length}):`)
    for (const p of catalog.slice(0, 14)) {
      lines.push(
        `- ${p.name} | ${p.category} | ${formatVnd(p.price)} | tồn ${p.stock} | shop ${p.shopName ?? 'SEDSP'} | email ${p.sellerEmail ?? '—'}`,
      )
    }
  }

  if (ctx.salesPerformance) {
    const s = ctx.salesPerformance.summary
    lines.push(
      `Doanh số seller: ${formatVnd(s.totalRevenue)}, ${s.completedOrders} đơn, AOV ${formatVnd(s.averageOrderValue)}`,
    )
    for (const tp of ctx.salesPerformance.topProducts.slice(0, 4)) {
      lines.push(`- Top: ${tp.productName} (${tp.quantitySold} sp, ${formatVnd(tp.revenue)})`)
    }
  }

  if (ctx.sellerDashboard) {
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
    lines.push(`Users: ${ctx.users.length} tổng, ${active} active`)
  }

  if (ctx.systemMetrics.length) {
    lines.push('Hệ thống:')
    for (const m of ctx.systemMetrics.slice(0, 6)) {
      lines.push(`- ${m.name}: ${m.value} (${m.status})`)
    }
  }

  const e = ctx.enrichment
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

export function buildSystemPrompt(ctx: ChatContext): string {
  return `Bạn là trợ lý mua sắm của SEDSP (Smart E-Commerce Decision Support Platform).

NHIỆM VỤ: ${ROLE_GUIDE[ctx.role] ?? ROLE_GUIDE.customer}

QUY TẮC BẮT BUỘC:
- Trả lời tiếng Việt (hoặc English nếu user hỏi English), ngắn gọn, thân thiện.
- Khi hỏi "chỗ nào bán / ai bán / shop nào / SP nào ngon": LUÔN nêu rõ **tên shop/seller** bán SP đó (lấy từ CONTEXT), kèm giá nếu có.
- Mỗi lần gợi ý SP: ghi shop bán (vd: "Laptop X — shop **Minh Electronics**").
- Ưu tiên số liệu trong CONTEXT; không bịa shop/giá/tồn.
- KHÔNG viết ghi chú kỹ thuật kiểu "(dữ liệu API)", "(API backend)", "mock", "hybrid" trong câu trả lời.
- Thanh toán: COD và VNPay (không nhắc MoMo).
- Thiếu dữ liệu → hướng dẫn xem **Cửa hàng** hoặc CSKH customer@sedsp.vn.
- Dùng **in đậm** cho tên shop, giá, số tồn quan trọng.

CONTEXT:
${serializeContext(ctx)}`
}
