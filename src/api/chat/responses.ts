import type { ChatContext } from '@/api/chat/context'
import type { ChatIntent } from '@/api/chat/intents'
import { apiConfig } from '@/api/config'
import { formatVnd, normalizeText } from '@/api/chat/match'
import {
  cheapestProducts,
  extractBudgetVnd,
  findProductsByQuery,
  productsUnderBudget,
} from '@/api/chat/products'
import type { Order, Product } from '@/types'
import { orderStatusLabel } from '@/utils/orderStatus'

export { findProductsByQuery } from '@/api/chat/products'

function greet(name: string): string {
  return name ? `${name}, ` : ''
}

export function productLines(products: Product[], limit = 4): string {
  return products
    .slice(0, limit)
    .map((p) => {
      const shop = p.shopName ? ` (${p.shopName})` : ''
      const stockNote = p.stock <= 0 ? ' (hết hàng)' : p.stock < 10 ? ` (còn ${p.stock})` : ''
      return `• ${p.name}${shop} — ${formatVnd(p.price)}${stockNote}`
    })
    .join('\n')
}

function apiNote(ctx: ChatContext): string {
  if (ctx.catalogSource === 'backend') return ' *(API backend)*'
  if (!ctx.backendOnline && !apiConfig.useMock) {
    return ' *(mock — backend :8080 chưa chạy)*'
  }
  if (ctx.dataSource === 'hybrid') return ' *(mock + demo)*'
  return ' *(mock local)*'
}

function formatOrderSummary(orders: Order[], limit = 3): string {
  if (!orders.length) return 'Bạn chưa có đơn hàng nào. Hãy thêm sản phẩm vào giỏ và checkout.'
  return orders
    .slice(0, limit)
    .map((o) => {
      const items = o.items.map((i) => i.productName).slice(0, 2).join(', ')
      return `• #${o.id} — ${orderStatusLabel(o.status)} — ${formatVnd(o.total)} (${items || '—'})`
    })
    .join('\n')
}

export function roleHelpHints(role: ChatContext['role']): string {
  switch (role) {
    case 'seller':
      return 'Gợi ý: "doanh thu tháng này", "SKU sắp hết", "kế hoạch khuyến mãi", "giá cạnh tranh".'
    case 'manager':
      return 'Gợi ý: "KPI tháng này", "đơn chờ xử lý", "what-if giảm 10%", "danh mục tăng trưởng".'
    case 'admin':
      return 'Gợi ý: "trạng thái hệ thống", "bao nhiêu user", "cảnh báo vận hành", "bảo mật JWT".'
    default:
      return 'Gợi ý: "web bán gì", "lien he nguoi ban mon X", "giao hàng", "đơn của tôi", "tai nghe giá bao nhiêu".'
  }
}

function categoryOverview(ctx: ChatContext): string {
  if (ctx.categories.length) {
    return ctx.categories
      .slice(0, 10)
      .map((c) => `• **${c.name}** (${c.productCount} SP)`)
      .join('\n')
  }
  const cats = new Map<string, number>()
  for (const p of ctx.products) {
    cats.set(p.category, (cats.get(p.category) ?? 0) + 1)
  }
  return [...cats.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([c, n]) => `• **${c}** (${n} SP)`)
    .join('\n') || '• Điện tử · Thời trang · Sách · Phụ kiện'
}

function shopOverviewReply(ctx: ChatContext): string {
  const name = greet(ctx.userName ?? '')
  const top = [...ctx.products].sort((a, b) => b.soldCount - a.soldCount).slice(0, 5)
  const total = ctx.products.length
  const catCount = ctx.categories.length || new Set(ctx.products.map((p) => p.category)).size
  const offlineHint =
    !ctx.backendOnline && !apiConfig.useMock
      ? '\n\n⚠ **Backend chưa kết nối** — chat đang dùng catalog mock (10 SP). Chạy `backend/` → `docker compose up -d` + `gradlew bootRun` để lấy **4 SP seed** từ Postgres.'
      : ''
  return `${name}**SEDSP** — sàn TMĐT + DSS & AI${apiNote(ctx)}.\n• **${total}** sản phẩm · **${catCount}** danh mục\n\n**Danh mục:**\n${categoryOverview(ctx)}\n\n**Nổi bật / bán chạy:**\n${top.length ? productLines(top, 5) : '• Xem **Cửa hàng**.'}\n\nHỏi tên SP, "giỏ hàng", "đơn của tôi" hoặc **what do you sell**.${offlineHint}`
}

function categoriesReply(ctx: ChatContext): string {
  const name = greet(ctx.userName ?? '')
  return `${name}**Danh mục${apiNote(ctx)}:**\n${categoryOverview(ctx)}\n\nLọc tại **Cửa hàng** hoặc hỏi "điện tử có gì".`
}

function cartSummaryReply(ctx: ChatContext): string {
  const name = greet(ctx.userName ?? '')
  if (ctx.role === 'guest') {
    return `${name}**Đăng nhập** để xem giỏ hàng cá nhân. Demo: **customer@sedsp.vn** / **12345678**`
  }
  if (!ctx.cartLines.length) {
    return `${name}Giỏ hàng **trống**${apiNote(ctx)}. Thêm SP từ **Cửa hàng** → **Thêm vào giỏ**.`
  }
  const lines = ctx.cartLines
    .slice(0, 6)
    .map((l) => `• ${l.productName} × **${l.quantity}** — ${formatVnd(l.subtotal)}`)
    .join('\n')
  return `${name}**Giỏ hàng${apiNote(ctx)}** (${ctx.cartItemCount} món):\n${lines}\n\n**Tổng: ${formatVnd(ctx.cartTotal)}**\n→ **Giỏ hàng** · **Thanh toán**`
}

function orderDetailReply(ctx: ChatContext): string {
  const name = greet(ctx.userName ?? '')
  const focused = ctx.enrichment?.focusedOrder
  if (focused) {
    const items = focused.items.map((i) => `${i.productName} ×${i.quantity}`).join(', ')
    return `${name}**Đơn #${focused.id}**${apiNote(ctx)}\n• Trạng thái: **${orderStatusLabel(focused.status)}**\n• Tổng: **${formatVnd(focused.total)}**\n• SP: ${items}\n• Địa chỉ: ${focused.shippingAddress}\n\nChi tiết **Đơn hàng của tôi**.`
  }
  if (ctx.orders.length) {
    return `${name}**Đơn gần nhất${apiNote(ctx)}:**\n${formatOrderSummary(ctx.orders, 3)}\n\nHỏi kèm mã đơn, vd: "đơn #${ctx.orders[0].id}".`
  }
  return `${name}Chưa có đơn hàng${apiNote(ctx)}. Đặt hàng qua **Giỏ hàng** → **Thanh toán**.`
}

function categoryBrowseReply(ctx: ChatContext, raw: string): string {
  const name = greet(ctx.userName ?? '')
  const fromApi = ctx.enrichment?.categoryProducts
  const n = normalizeText(raw)
  const cat = ctx.categories.find((c) =>
    normalizeText(c.name)
      .split(/\s+/)
      .some((w: string) => w.length > 3 && n.includes(w)),
  )
  const products = fromApi?.length
    ? fromApi
    : cat
      ? ctx.products.filter((p) => p.category === cat.name)
      : findProductsByQuery(ctx.products, raw)
  if (!products.length) {
    return `${name}Chưa tìm thấy SP theo danh mục — thử **Cửa hàng** hoặc hỏi "web bán gì".`
  }
  const label = cat?.name ?? products[0]?.category ?? 'Danh mục'
  return `${name}**${label}**${apiNote(ctx)}:\n${productLines(products.slice(0, 6), 6)}\n\nXem thêm **Cửa hàng**.`
}

function productSearchReply(ctx: ChatContext, raw: string): string {
  const name = greet(ctx.userName ?? '')
  const hits = ctx.enrichment?.searchResults?.length
    ? ctx.enrichment.searchResults
    : findProductsByQuery(ctx.products, raw)
  if (!hits.length) {
    return `${name}Gõ tên SP cụ thể, vd: "tìm tai nghe bluetooth" hoặc "bàn phím cơ".`
  }
  return `${name}**Kết quả tìm kiếm${apiNote(ctx)}:**\n${productLines(hits.slice(0, 6), 6)}`
}

function cheapestReply(ctx: ChatContext): string {
  const name = greet(ctx.userName ?? '')
  const list = cheapestProducts(ctx.products, 5)
  if (!list.length) {
    return `${name}Chưa có SP để so giá — xem **Cửa hàng**.`
  }
  return `${name}**Rẻ nhất hiện có${apiNote(ctx)}:**\n${productLines(list, 5)}\n\nHỏi "dưới 2 triệu" để lọc ngân sách.`
}

function budgetReply(ctx: ChatContext, raw: string): string {
  const name = greet(ctx.userName ?? '')
  const budget = extractBudgetVnd(raw)
  if (!budget) {
    return `${name}Cho mình biết ngân sách, vd: **"dưới 2 triệu"** hoặc **"budget 500k"**.`
  }
  const hits = productsUnderBudget(ctx.products, budget, 6)
  if (!hits.length) {
    return `${name}Không có SP ≤ **${formatVnd(budget)}**${apiNote(ctx)}. Thử mức cao hơn hoặc hỏi **"sp rẻ nhất"**.`
  }
  return `${name}**Phù hợp ngân sách ≤ ${formatVnd(budget)}**${apiNote(ctx)}:\n${productLines(hits, 6)}\n\n→ Mở **Cửa hàng** để thêm giỏ.`
}

function contactSellerReply(ctx: ChatContext, raw: string): string {
  const name = greet(ctx.userName ?? '')
  const p = ctx.enrichment?.product ?? findProductsByQuery(ctx.products, raw)[0]
  if (!p) {
    return `${name}Bạn muốn liên hệ người bán sản phẩm nào? Hỏi cụ thể, vd: "lien he nguoi ban mon tai nghe bluetooth".`
  }
  const shop = p.shopName ?? 'SEDSP Official'
  const email = p.sellerEmail ?? 'seller@sedsp.vn'
  const phone = p.sellerPhone ?? '1900-SEDSP'
  const contactNote = p.sellerEmail
    ? ''
    : '\n\n_(Email/SĐT mặc định demo — backend chưa trả sellerEmail/sellerPhone.)_'
  return `${name}**Liên hệ người bán — ${p.name}**${apiNote(ctx)}\n\n• **Shop:** ${shop}\n• **Email:** ${email}\n• **Điện thoại:** ${phone}${contactNote}\n\n👉 Xem trang SP **${p.name}** · menu **Liên hệ** CSKH: **customer@sedsp.vn**`
}

function contactEscalateReply(ctx: ChatContext, raw: string): string {
  return escalateReply(ctx, raw, 'explicit')
}

export function escalateReply(
  ctx: ChatContext,
  raw: string,
  mode: 'unknown' | 'explicit' = 'unknown',
): string {
  const name = greet(ctx.userName ?? '')
  const matched = findProductsByQuery(ctx.products, raw)[0]
  const intro =
    mode === 'explicit'
      ? `${name}**Chuyển liên hệ hỗ trợ:**\n`
      : `${name}Mình chưa có câu trả lời chính xác cho: *"${raw.slice(0, 80)}${raw.length > 80 ? '…' : ''}"*.\n\n**Chuyển sang người phụ trách:**\n`

  const productBlock = matched
    ? `• **Shop "${matched.shopName ?? 'SEDSP Official'}"** — ${matched.name}\n  Email: **${matched.sellerEmail ?? 'seller@sedsp.vn'}** · SĐT: **${matched.sellerPhone ?? '1900-SEDSP'}**\n`
    : ''

  const roleBlock: Record<ChatContext['role'], string> = {
    guest:
      '• **CSKH**: menu **Liên hệ** · email **customer@sedsp.vn**\n• **Đăng nhập** (Khách hàng) để theo dõi đơn & chat cá nhân hóa',
    customer:
      '• **CSKH / đơn hàng**: **Liên hệ** · **customer@sedsp.vn**\n• **Quản lý vận hành**: **manager@sedsp.vn**\n• **Kỹ thuật / admin**: **admin@sedsp.vn**',
    seller:
      '• **Quản lý seller**: **manager@sedsp.vn**\n• **Admin hệ thống**: **admin@sedsp.vn**\n• Hotline demo: **1900-SEDSP**',
    manager:
      '• **Admin kỹ thuật**: **admin@sedsp.vn**\n• **Giám sát**: menu **Giám sát hệ thống**',
    admin:
      '• Kiểm tra **Giám sát hệ thống** & logs backend\n• Escalation dev: team SEDSP qua kênh nội bộ',
  }

  return `${intro}${productBlock}${roleBlock[ctx.role]}\n\nHoặc thử hỏi cụ thể hơn:\n${roleHelpHints(ctx.role)}`
}

function complaintReply(ctx: ChatContext): string {
  const name = greet(ctx.userName ?? '')
  const orderHint =
    ctx.orders.length > 0
      ? `\nĐơn gần nhất: **#${ctx.orders[0].id}** — gửi kèm mã đơn khi liên hệ.`
      : ''
  return `${name}Rất tiếc về trải nghiệm của bạn. Mình ghi nhận và chuyển **ưu tiên** cho CSKH.\n\n**Liên hệ ngay:**\n• Email **customer@sedsp.vn** · menu **Liên hệ**\n• Quản lý: **manager@sedsp.vn** (khiếu nại nghiêm trọng)\n• Admin: **admin@sedsp.vn**${orderHint}\n\nMô tả thêm sự cố (mã đơn, tên SP) để xử lý nhanh hơn.`
}

function passwordReply(ctx: ChatContext): string {
  const name = greet(ctx.userName ?? '')
  return `${name}**Quên / đổi mật khẩu:**\n• Trang **Đăng nhập** → **Quên mật khẩu**\n• Nhập email — hệ thống gửi OTP qua mail (cấu hình MAIL_*)\n• Demo: mật khẩu chung **12345678** cho tài khoản seed\n\nVẫn lỗi? Email **admin@sedsp.vn**.`
}

function checkoutReply(ctx: ChatContext): string {
  const name = greet(ctx.userName ?? '')
  const loginNote = ctx.role === 'guest' ? '\n\n👉 **Đăng nhập** trước khi checkout.' : ''
  return `${name}**Cách đặt hàng:**\n1. Chọn SP → **Thêm vào giỏ**\n2. **Giỏ hàng** → kiểm tra số lượng\n3. **Thanh toán** → điền địa chỉ & phương thức (COD / chuyển khoản / MoMo)\n4. Xác nhận — theo dõi tại **Đơn hàng của tôi**${loginNote}`
}

function productReviewReply(ctx: ChatContext, raw: string): string {
  const name = greet(ctx.userName ?? '')
  const e = ctx.enrichment
  const p = e?.product ?? findProductsByQuery(ctx.products, raw)[0]
  if (p) {
    const summary = e?.ratingSummary
    const reviews = e?.reviews ?? []
    let block = `${name}**${p.name}**${apiNote(ctx)}\n`
    if (summary && summary.totalReviews > 0) {
      block += `• Rating: **${summary.averageRating.toFixed(1)}★** / ${summary.totalReviews} đánh giá\n`
    } else {
      block += `• Rating hiển thị: **${p.rating}★** — xem tab **Đánh giá** trên trang SP\n`
    }
    if (reviews.length) {
      block += `\n**Nhận xét gần đây (API):**\n${reviews.map((r) => `• ${r.userName}: ${r.rating}★ — "${r.comment.slice(0, 60)}${r.comment.length > 60 ? '…' : ''}"`).join('\n')}`
    }
    block += `\n\nShop: **${p.shopName ?? 'SEDSP Official'}**`
    return block
  }
  return `${name}Hỏi tên SP cụ thể (vd: "tai nghe review") hoặc mở **chi tiết SP** → **Đánh giá**.`
}

function compareReply(ctx: ChatContext, raw: string): string {
  const name = greet(ctx.userName ?? '')
  const matched = findProductsByQuery(ctx.products, raw)
  if (matched.length >= 2) {
    const [a, b] = matched
    return `${name}**So sánh nhanh:**\n• **${a.name}** — ${formatVnd(a.price)} · ${a.category} · đã bán ${a.soldCount}\n• **${b.name}** — ${formatVnd(b.price)} · ${b.category} · đã bán ${b.soldCount}\n\nXem mô tả đầy đủ trên **Cửa hàng**.`
  }
  return `${name}Hãy nêu **2 sản phẩm** cần so sánh, vd: "so sánh tai nghe và loa bluetooth".`
}

function sellerRatingReply(ctx: ChatContext): string {
  const name = greet(ctx.userName ?? '')
  const dash = ctx.sellerDashboard
  if (dash?.averageRating != null) {
    let msg = `${name}**Rating shop${apiNote(ctx)}:** **${dash.averageRating.toFixed(1)}★**`
    if (dash.totalReviews) msg += ` · ${dash.totalReviews} review`
    if (dash.ratingWarning) msg += `\n⚠ ${dash.ratingWarning}`
    return msg + `\n\nTrả lời review <24h · **Quản lý SP** · **Bảng doanh số**.`
  }
  const catalog = ctx.sellerProducts.length ? ctx.sellerProducts : ctx.products
  const avgSold = catalog.length
    ? catalog.reduce((s, p) => s + p.soldCount, 0) / catalog.length
    : 0
  return `${name}**Rating shop:** theo dõi review từng SP.\n• TB lượt bán/SP: **${avgSold.toFixed(0)}**\n\n**Bảng doanh số** & DSS seller.`
}

function productInfoReply(ctx: ChatContext, raw: string): string {
  const name = greet(ctx.userName ?? '')
  const p = ctx.enrichment?.product ?? findProductsByQuery(ctx.products, raw)[0]
  if (p) {
    const inv = ctx.enrichment?.inventory
    const stock = inv ? inv.availableQuantity : p.stock
    const desc = p.description
      ? p.description.slice(0, 160) + (p.description.length > 160 ? '…' : '')
      : 'Xem mô tả đầy đủ trên trang SP.'
    return `${name}**${p.name}**${apiNote(ctx)}\n• Danh mục: **${p.category}**\n• Giá: **${formatVnd(p.price)}**${p.originalPrice && p.originalPrice > p.price ? ` (gốc ${formatVnd(p.originalPrice)})` : ''}\n• Tồn${inv ? ' (API inventory)' : ''}: **${stock <= 0 ? 'hết hàng' : stock}**\n• Shop: **${p.shopName ?? 'SEDSP Official'}**\n• ${desc}`
  }
  return `${name}Bạn muốn biết SP nào? Hỏi tên cụ thể, vd: "thong tin tai nghe bluetooth".`
}

function buildCustomerIntent(ctx: ChatContext, intent: ChatIntent, raw: string): string | null {
  const name = greet(ctx.userName ?? '')
  const lower = normalizeText(raw)

  switch (intent) {
    case 'shipping':
      return `${name}**Chính sách giao hàng SEDSP:**\n• Nội thành: 1–2 ngày\n• Ngoại tỉnh: 3–5 ngày\n• Miễn phí ship đơn từ **500.000₫**\n• Theo dõi tại **Đơn hàng của tôi** sau khi đặt.`
    case 'payment':
      return `${name}**Hình thức thanh toán:**\n• COD — trả khi nhận hàng\n• Chuyển khoản ngân hàng\n• Ví MoMo / thẻ\nGiá đã gồm VAT. Chọn ở bước **Thanh toán**.`
    case 'orders': {
      const detail = orderDetailReply(ctx)
      if (ctx.enrichment?.focusedOrder) return detail
      const pending = ctx.orders.filter((o) => o.status === 'pending').length
      const shipping = ctx.orders.filter((o) => o.status === 'shipping').length
      return `${name}**Đơn hàng${apiNote(ctx)}** (${ctx.orders.length} đơn):\n${formatOrderSummary(ctx.orders)}\n${pending ? `\n⚠ ${pending} đơn đang chờ xác nhận.` : ''}${shipping ? `\n🚚 ${shipping} đơn đang giao.` : ''}\n\nXem **Đơn hàng của tôi**.`
    }
    case 'order_detail':
      return orderDetailReply(ctx)
    case 'order_cancel': {
      const cancellable = ctx.orders.filter((o) => o.status === 'pending' || o.status === 'confirmed')
      if (!cancellable.length) {
        return `${name}Không có đơn nào có thể hủy. Chỉ hủy khi **chờ xác nhận** hoặc **đã xác nhận** (chưa giao).`
      }
      return `${name}**${cancellable.length}** đơn có thể hủy:\n${formatOrderSummary(cancellable, 3)}\n\n**Chi tiết đơn** → **Hủy đơn**.`
    }
    case 'cart':
      return cartSummaryReply(ctx)
    case 'cart_summary':
      return cartSummaryReply(ctx)
    case 'recommend':
      if (ctx.recommendations.length) {
        const picks = ctx.recommendations.slice(0, 3).map((r) => {
          const p = ctx.products.find((x) => x.id === r.productId)
          return p ? `• ${p.name} (${Math.round(r.score * 100)}%) — ${r.reason}` : null
        }).filter(Boolean)
        if (picks.length) {
          return `${name}**Gợi ý cá nhân hóa:**\n${picks.join('\n')}\n\n**Gợi ý AI** trên menu.`
        }
      }
      return shopOverviewReply(ctx).replace('**SEDSP**', '**Gợi ý mua**')
    case 'promo': {
      const onSale = ctx.products.filter((p) => p.originalPrice && p.originalPrice > p.price).slice(0, 4)
      if (onSale.length) {
        return `${name}**Đang giảm giá:**\n${productLines(onSale)}\n\nBanner **Giảm 30%** trên nhiều SP.`
      }
      return `${name}Shop **giảm 30%** nhiều mặt hàng — lọc tại **Cửa hàng** hoặc hỏi tên SP.`
    }
    case 'return_policy':
      return `${name}**Đổi trả & bảo hành:**\n• Đổi trả **7 ngày** nếu lỗi NSX / sai mô tả\n• Giữ hóa đơn & tem BH\n• **Liên hệ** hoặc **customer@sedsp.vn** kèm mã đơn`
    case 'account':
      return `${name}**Tài khoản:**\n• **Đăng ký** — email + mật khẩu\n• **Đăng nhập** — email đã đăng ký\n• Demo: **customer@sedsp.vn** / **12345678**`
    case 'product_stock': {
      const target = ctx.enrichment?.product ?? findProductsByQuery(ctx.products, raw)[0]
      const inv = ctx.enrichment?.inventory
      if (target) {
        const qty = inv?.availableQuantity ?? target.stock
        if (qty <= 0) {
          return `${name}**${target.name}** **hết hàng**${inv ? ' (API inventory)' : ''}. Danh mục **${target.category}** · shop **${target.shopName ?? 'seller@sedsp.vn'}**.`
        }
        return `${name}**${target.name}** còn **${qty}**${inv ? ' (tồn API)' : ''} — **${formatVnd(target.price)}**. Thêm giỏ trên trang chi tiết.`
      }
      break
    }
    case 'product_price': {
      const matched = findProductsByQuery(ctx.products, raw)
      if (matched.length) {
        return `${name}**Bảng giá:**\n${productLines(matched.slice(0, 5))}\n\nChi tiết tại **Cửa hàng**.`
      }
      break
    }
    default:
      break
  }

  if (intent === 'product_price' || intent === 'product_stock' || /gia|price|ton|stock/.test(lower)) {
    const matched = findProductsByQuery(ctx.products, raw)
    if (matched.length) {
      return `${name}**Liên quan:**\n${productLines(matched.slice(0, 4))}`
    }
  }

  return null
}

function buildSellerIntent(ctx: ChatContext, intent: ChatIntent): string | null {
  const name = greet(ctx.userName ?? '')
  const catalog = ctx.sellerProducts.length ? ctx.sellerProducts : ctx.products

  switch (intent) {
    case 'seller_revenue': {
      const perf = ctx.salesPerformance
      if (perf) {
        const chart = perf.monthlyRevenue.slice(-3).map((m) => `• ${m.label}: ${formatVnd(m.value)}`).join('\n')
        const top = perf.topProducts.slice(0, 3).map((p) => `• ${p.productName}: ${p.quantitySold} sp · ${formatVnd(p.revenue)}`).join('\n')
        return `${name}**Doanh số${apiNote(ctx)}:**\n• Tổng: **${formatVnd(perf.summary.totalRevenue)}**\n• Đơn HT: **${perf.summary.completedOrders}**\n• AOV: **${formatVnd(perf.summary.averageOrderValue)}**${chart ? `\n\n**3 tháng:**\n${chart}` : ''}${top ? `\n\n**Top SP (API):**\n${top}` : ''}\n\n**Bảng doanh số**.`
      }
      const est = catalog.reduce((s, p) => s + p.soldCount * p.price, 0)
      return `${name}Doanh thu ước tính catalog: **${formatVnd(est)}**. **Bảng doanh số** khi có dữ liệu đơn.`
    }
    case 'seller_inventory': {
      const dash = ctx.sellerDashboard
      if (dash?.lowStockProducts.length) {
        const lines = dash.lowStockProducts.slice(0, 6).map((p) => `• ${p.productName} — còn **${p.quantity}** (API)`).join('\n')
        return `${name}**Tồn kho thấp${apiNote(ctx)}:**\n${lines}\n\nCập nhật **Tồn kho** / **Quản lý SP**.`
      }
      const low = catalog.filter((p) => p.stock > 0 && p.stock < 20).sort((a, b) => a.stock - b.stock)
      const out = catalog.filter((p) => p.stock <= 0)
      if (low.length || out.length) {
        let msg = `${name}**Cảnh báo tồn kho:**\n`
        if (low.length) msg += `Sắp hết:\n${productLines(low.slice(0, 4))}\n`
        if (out.length) msg += `\nHết hàng:\n${productLines(out.slice(0, 3))}\n`
        return msg + `\n**Tồn kho** / **Quản lý SP**.`
      }
      if (ctx.sellerInsights.length) {
        const inv = ctx.sellerInsights.filter((i) => i.category === 'inventory').slice(0, 3)
        if (inv.length) {
          return `${name}**DSS tồn kho:**\n${inv.map((i) => `• ${i.title}: ${i.description}`).join('\n')}`
        }
      }
      return `${name}Tồn kho **ổn định**. Theo dõi **Tồn kho**.`
    }
    case 'seller_pricing': {
      const slow = [...catalog].sort((a, b) => a.soldCount - b.soldCount).slice(0, 3)
      if (slow.length) {
        return `${name}**SKU bán chậm:**\n${productLines(slow)}\n\nGiảm **3–5%** hoặc bundle — **DSS Người bán**.`
      }
      return `${name}Xem **DSS Người bán** → Giá cạnh tranh.`
    }
    case 'seller_promo': {
      const highStock = catalog.filter((p) => p.stock > 25).slice(0, 2)
      const top = [...catalog].sort((a, b) => b.soldCount - a.soldCount)[0]
      return `${name}**Kế hoạch tuần:**\n• Flash sale SKU tồn cao${highStock.length ? `: ${highStock.map((p) => p.name).join(', ')}` : ''}\n• Bundle + ${top?.name ?? 'SP chủ lực'}\n• Trả review <24h\n\n**DSS** + **Bảng doanh số**.`
    }
    case 'seller_add_product':
      return `${name}**Thêm SP:**\n1. **Quản lý SP** → **+ Thêm SP**\n2. Danh mục, giá, tồn\n3. Upload ảnh Cloudinary\n4. Lưu — hiện cửa hàng ngay.`
    case 'seller_orders': {
      if (ctx.orders.length) {
        return `${name}**${ctx.orders.length} đơn cần xử lý${apiNote(ctx)}:**\n${formatOrderSummary(ctx.orders, 5)}\n\n👉 **Quản lý đơn hàng** (/seller/orders) để cập nhật trạng thái.`
      }
      return `${name}Chưa có đơn từ API. Xem **Quản lý đơn hàng** khi có khách đặt.`
    }
    case 'seller_recent_orders': {
      const recent = ctx.sellerDashboard?.recentOrders ?? []
      if (recent.length) {
        const lines = recent.slice(0, 5).map((o) => `• #${o.orderId} — ${o.customer} — ${formatVnd(o.total)} — ${o.status}`).join('\n')
        return `${name}**Đơn gần đây${apiNote(ctx)}:**\n${lines}`
      }
      return `${name}Chưa có đơn gần đây từ API dashboard. Xem **Bảng doanh số**.`
    }
    case 'seller_top_products': {
      const top = ctx.salesPerformance?.topProducts ?? []
      if (top.length) {
        return `${name}**SP bán chạy${apiNote(ctx)}:**\n${top.slice(0, 5).map((p) => `• ${p.productName}: **${p.quantitySold}** sp · ${formatVnd(p.revenue)}`).join('\n')}`
      }
      const local = [...catalog].sort((a, b) => b.soldCount - a.soldCount).slice(0, 5)
      return `${name}**Top catalog:**\n${productLines(local, 5)}`
    }
    case 'seller_rating':
      return sellerRatingReply(ctx)
    default:
      return null
  }
}

function buildManagerIntent(ctx: ChatContext, intent: ChatIntent): string | null {
  const name = greet(ctx.userName ?? '')
  const orders = ctx.orders
  const revenue = orders.reduce((s, o) => s + o.total, 0)
  const pending = orders.filter((o) => o.status === 'pending').length
  const delivered = orders.filter((o) => o.status === 'delivered').length
  const aov = orders.length ? revenue / orders.length : 0
  const cancelled = orders.filter((o) => o.status === 'cancelled').length
  const cancelRate = orders.length ? ((cancelled / orders.length) * 100).toFixed(1) : '0'

  switch (intent) {
    case 'manager_kpi':
      return `${name}**KPI** (${orders.length} đơn):\n• Doanh thu: **${formatVnd(revenue)}**\n• AOV: **${formatVnd(aov)}**\n• Đã giao: **${delivered}**\n• Chờ xử lý: **${pending}**\n• Hủy: **${cancelRate}%**\n\n**Dashboard** & **DSS Quản lý**.`
    case 'manager_pending':
      if (!pending) return `${name}Không có đơn chờ — **ổn định**.`
      return `${name}**${pending} đơn chờ:**\n${formatOrderSummary(orders.filter((o) => o.status === 'pending').slice(0, 5), 5)}`
    case 'manager_segment': {
      const cats = new Map<string, number>()
      for (const o of orders) {
        for (const item of o.items) {
          const p = ctx.products.find((x) => x.id === item.productId)
          cats.set(p?.category ?? 'Khác', (cats.get(p?.category ?? 'Khác') ?? 0) + item.quantity * item.unitPrice)
        }
      }
      const lines = [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, v]) => `• ${c}: ${formatVnd(v)}`).join('\n')
      return `${name}**Phân khúc doanh thu:**\n${lines || '• Chưa đủ dữ liệu'}\n\n**Phân tích**.`
    }
    case 'manager_whatif':
      return `${name}**What-if giảm 10%:**\n• Đơn: **+18%**\n• Biên LN: **-3%**\n• GMV ròng: **+9%**\n\n**DSS Quản lý** → What-if.`
    case 'manager_trend': {
      const cats = new Map<string, number>()
      for (const p of ctx.products) cats.set(p.category, (cats.get(p.category) ?? 0) + p.soldCount)
      const lines = [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, n]) => `• ${c}: ${n > 30 ? 'cao ↑' : 'ổn →'}`).join('\n')
      return `${name}**Xu hướng danh mục:**\n${lines}\n\n**Phân tích** + **DSS**.`
    }
    case 'manager_revenue':
      return `${name}Doanh thu **${formatVnd(revenue)}** / **${orders.length}** đơn. AOV **${formatVnd(aov)}**.`
    case 'manager_insights': {
      if (ctx.managerInsights.length) {
        return `${name}**DSS Quản lý${apiNote(ctx)}:**\n${ctx.managerInsights.slice(0, 5).map((i) => `• **${i.title}** (${i.impact}): ${i.description}`).join('\n')}\n\n**DSS Quản lý** · **Phân tích**.`
      }
      return `${name}Chưa có insights — xem **Dashboard** khi có thêm đơn hàng API.`
    }
    default:
      return null
  }
}

function buildAdminIntent(ctx: ChatContext, intent: ChatIntent): string | null {
  const name = greet(ctx.userName ?? '')
  const users = ctx.users
  const active = users.filter((u) => u.active).length
  const byRole = (r: string) => users.filter((u) => u.role === r).length

  switch (intent) {
    case 'admin_system': {
      const metrics = ctx.systemMetrics
      if (metrics.length) {
        const lines = metrics.slice(0, 6).map((m) => {
          const icon = m.status === 'ok' ? '✓' : m.status === 'warn' ? '!' : '✗'
          return `• ${icon} ${m.name}: ${m.value}`
        }).join('\n')
        return `${name}**Hệ thống:**\n${lines}\n\n**Giám sát hệ thống**.`
      }
      return `${name}Spring Boot + PostgreSQL + Redis — **Giám sát hệ thống**.`
    }
    case 'admin_users':
      if (users.length) {
        return `${name}**Users** (${users.length}):\n• Active: **${active}**\n• Customer ${byRole('customer')} · Seller ${byRole('seller')} · Manager ${byRole('manager')} · Admin ${byRole('admin')}\n\n**Người dùng**.`
      }
      return `${name}RBAC tại **Người dùng**. Demo seed 4 account.`
    case 'admin_security':
      return `${name}**Bảo mật:** JWT + RBAC · Error 1h **0.02%** · OAuth2 Google optional · Đổi JWT_SECRET production.`
    case 'admin_alerts': {
      const warns = ctx.systemMetrics.filter((m) => m.status === 'warn' || m.status === 'error')
      if (warns.length) {
        return `${name}**Cảnh báo:**\n${warns.map((m) => `• ${m.name}: ${m.value}`).join('\n')}\n\n**Giám sát**.`
      }
      return `${name}**Không cảnh báo nghiêm trọng.** Queue OK · Error **0.02%** · Backend online.`
    }
    case 'admin_config':
      return `${name}**Env (application.yml):** CLOUDINARY_* · MAIL_* · GOOGLE_CLIENT_* · JWT_SECRET`
    default:
      return null
  }
}

export function buildIntentReply(ctx: ChatContext, intent: ChatIntent, raw: string): string | null {
  const name = greet(ctx.userName ?? '')

  switch (intent) {
    case 'greeting':
      return `${name}Chào bạn! Tôi trợ lý **SEDSP** (role **${ctx.role}**). ${roleHelpHints(ctx.role)}`
    case 'thanks':
      return `${name}Không có gì! Cần thêm cứ hỏi nhé.`
    case 'help':
      return `${name}**Tôi có thể giúp:**\n${roleHelpHints(ctx.role)}\n\nDùng **gợi ý nhanh** phía trên.`
    case 'platform':
      return `${name}**SEDSP** — Smart E-Commerce Decision Support Platform: mua sắm, bán hàng, DSS & AI hỗ trợ quyết định.`
    case 'shop_overview':
      return shopOverviewReply(ctx)
    case 'categories':
      return categoriesReply(ctx)
    case 'contact_seller':
      return contactSellerReply(ctx, raw)
    case 'contact_escalate':
      return contactEscalateReply(ctx, raw)
    case 'complaint':
      return complaintReply(ctx)
    case 'password':
      return passwordReply(ctx)
    case 'checkout':
      return checkoutReply(ctx)
    case 'product_info':
      return productInfoReply(ctx, raw)
    case 'product_review':
      return productReviewReply(ctx, raw)
    case 'compare':
      return compareReply(ctx, raw)
    case 'category_browse':
      return categoryBrowseReply(ctx, raw)
    case 'product_search':
      return productSearchReply(ctx, raw)
    case 'product_cheapest':
      return cheapestReply(ctx)
    case 'product_budget':
      return budgetReply(ctx, raw)
    case 'cart_summary':
      return cartSummaryReply(ctx)
    case 'order_detail':
      return orderDetailReply(ctx)
    default:
      break
  }

  if (ctx.role === 'customer') return buildCustomerIntent(ctx, intent, raw)
  if (ctx.role === 'guest') {
    const base = buildCustomerIntent(ctx, intent, raw)
    if (base) {
      if (['orders', 'cart', 'recommend'].includes(intent)) {
        return base.replace(/của bạn/gi, 'sau khi đăng nhập') + '\n\n👉 **Đăng nhập** để xem đơn & giỏ cá nhân.'
      }
      if (intent === 'account') {
        return base + '\n\n👉 **Đăng nhập** role Khách hàng để mua & gợi ý AI.'
      }
      return base
    }
    if (intent === 'orders' || intent === 'cart') {
      return `${name}**Đăng nhập** (Khách hàng) để xem đơn, giỏ & gợi ý cá nhân. Demo: **customer@sedsp.vn** / **12345678**`
    }
    return null
  }
  if (ctx.role === 'seller') return buildSellerIntent(ctx, intent)
  if (ctx.role === 'manager') return buildManagerIntent(ctx, intent)
  if (ctx.role === 'admin') return buildAdminIntent(ctx, intent)

  return null
}
