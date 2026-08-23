import type { ChatContext } from '@/api/chat/context'
import type { ChatIntent } from '@/api/chat/intents'
import { normalizeText } from '@/api/chat/match'
import type { UserRole } from '@/types'

/** Chỉ seller / manager / admin */
export const SELLER_OPS_INTENTS = new Set<ChatIntent>([
  'seller_top_products',
  'seller_recent_orders',
  'seller_revenue',
  'seller_inventory',
  'seller_pricing',
  'seller_promo',
  'seller_add_product',
  'seller_orders',
  'seller_rating',
  'seller_dss_demand',
  'seller_dss_price',
  'seller_dss_inventory',
  'seller_whatif',
  'seller_purchase_orders',
])

export const MANAGER_OPS_INTENTS = new Set<ChatIntent>([
  'manager_kpi',
  'manager_pending',
  'manager_segment',
  'manager_whatif',
  'manager_trend',
  'manager_revenue',
  'manager_insights',
])

export const ADMIN_OPS_INTENTS = new Set<ChatIntent>([
  'admin_system',
  'admin_users',
  'admin_security',
  'admin_alerts',
  'admin_config',
])

/** Ưu tiên khi khách / guest hỏi */
export const SHOPPER_FOCUS_INTENTS = new Set<ChatIntent>([
  'product_search',
  'product_budget',
  'product_cheapest',
  'category_browse',
  'recommend',
  'compare',
  'product_info',
  'product_price',
  'product_stock',
  'product_review',
  'shop_overview',
  'categories',
  'where_to_buy',
  'contact_seller',
  'promo',
  'orders',
  'order_detail',
  'order_cancel',
  'cart',
  'cart_summary',
  'shipping',
  'checkout',
  'payment',
  'return_policy',
])

function greet(name?: string): string {
  return name ? `${name}, ` : ''
}

/** Gợi ý nhanh theo vai trò — hiện ở greeting / help / unknown. */
export function roleHelpHints(role: UserRole): string {
  switch (role) {
    case 'seller':
      return 'Gợi ý: **doanh thu tháng**, **đơn bán gần đây**, **SKU sắp hết**, **DSS dự báo nhu cầu**, **khuyến nghị giá**, **what-if giảm 10%**. (Bạn vẫn có thể hỏi mua hàng như khách.)'
    case 'manager':
      return 'Gợi ý: **KPI tháng**, **đơn chờ duyệt**, **doanh thu sàn**, **xu hướng danh mục**, **what-if khuyến mãi**.'
    case 'admin':
      return 'Gợi ý: **trạng thái hệ thống**, **số user**, **cảnh báo vận hành**, **bảo mật JWT**.'
    case 'guest':
      return 'Gợi ý: **điện thoại có gì**, **dưới 2 triệu**, **sản phẩm rẻ nhất**, **mã giảm giá**. Đăng nhập để xem **đơn hàng** & **giỏ hàng**.'
    default:
      return 'Gợi ý: **tìm sản phẩm**, **so sánh giá**, **đơn hàng của tôi**, **đánh giá khách**, **voucher**, **theo dõi giao hàng**.'
  }
}

export function roleFocusLabel(role: UserRole): string {
  switch (role) {
    case 'seller':
      return 'Người bán — DSS, doanh số, tồn kho, đơn bán'
    case 'manager':
      return 'Quản lý — KPI sàn, đơn chờ, insights'
    case 'admin':
      return 'Admin — hệ thống & người dùng'
    case 'guest':
      return 'Khách chưa đăng nhập — tư vấn mua sắm & chính sách'
    default:
      return 'Khách hàng — tư vấn SP, đơn hàng, đánh giá'
  }
}

/** Chỉnh intent theo role + từ khóa (tránh nhầm đơn bán / đơn mua, DSS / tìm SP). */
export function resolveIntentForRole(
  intent: ChatIntent | null,
  role: UserRole,
  raw: string,
): ChatIntent | null {
  const n = normalizeText(raw)

  if (role === 'seller') {
    if (/don mua|mua nhu khach|lich su mua cua toi|don cua toi mua/.test(n)) {
      return 'seller_purchase_orders'
    }
    if (
      intent === 'orders' ||
      /don ban|don cua khach|don seller|don gan day|don moi|don cho xu ly|don chua giao|don hang|theo doi don/.test(n)
    ) {
      if (!/don mua|mua nhu khach/.test(n)) {
        return 'seller_recent_orders'
      }
    }
    if (/doanh thu|doanh so|revenue|thu ve|ban duoc bao nhieu|dashboard ban hang/.test(n)) {
      return 'seller_revenue'
    }
    if (/ton kho|sap het|het hang sku|nhap them|low stock|ton thap/.test(n)) {
      return 'seller_inventory'
    }
    if (/what.?if|giam gia\s*\d|mo phong giam|tang gia\s*\d/.test(n)) {
      return 'seller_whatif'
    }
    if (/du bao nhu cau|demand forecast|nhu cau tuan/.test(n)) {
      return 'seller_dss_demand'
    }
    if (/khuyen nghi gia|nen tang gia|nen giam gia|goi y gia ban/.test(n)) {
      return 'seller_dss_price'
    }
    if (/sp ban chay|top product|best seller|hang ban nhieu/.test(n)) {
      return 'seller_top_products'
    }
  }

  if (role === 'manager') {
    if (/kpi|chi so|dashboard quan ly/.test(n)) return 'manager_kpi'
    if (/don cho|pending|cho duyet/.test(n)) return 'manager_pending'
    if (/doanh thu sàn|doanh thu san|revenue platform/.test(n)) return 'manager_revenue'
  }

  if ((role === 'customer' || role === 'guest') && intent) {
    if (SELLER_OPS_INTENTS.has(intent) || MANAGER_OPS_INTENTS.has(intent) || ADMIN_OPS_INTENTS.has(intent)) {
      return 'help'
    }
  }
  if (role !== 'admin' && intent && ADMIN_OPS_INTENTS.has(intent)) {
    return 'help'
  }
  if (role !== 'manager' && role !== 'admin' && intent && MANAGER_OPS_INTENTS.has(intent)) {
    return 'help'
  }

  return intent
}

export function intentAllowedForRole(intent: ChatIntent, role: UserRole): boolean {
  if (role === 'admin') return true
  if (ADMIN_OPS_INTENTS.has(intent)) return false
  if (MANAGER_OPS_INTENTS.has(intent)) return role === 'manager'
  if (SELLER_OPS_INTENTS.has(intent)) return role === 'seller'
  return true
}

export function outOfScopeReply(ctx: ChatContext, blockedIntent: ChatIntent): string {
  const name = greet(ctx.userName ?? '')
  if (ctx.role === 'customer' || ctx.role === 'guest') {
    return `${name}Mục **${humanIntentLabel(blockedIntent)}** dành cho **người bán / quản lý** trên SEDSP.\n\nMình tập trung hỗ trợ bạn:\n• **Tư vấn & gợi ý sản phẩm** (tên SP, ngân sách, so sánh)\n• **Theo dõi đơn hàng & giỏ hàng**\n• **Đánh giá / review sản phẩm**\n• **Voucher & chính sách giao / đổi trả**\n\n${roleHelpHints(ctx.role)}`
  }
  if (ctx.role === 'seller') {
    return `${name}Bạn cần quyền **quản lý** cho mục này. Mình có thể hỗ trợ **doanh thu shop**, **DSS**, **tồn kho**, **đơn bán** — hoặc hỏi mua hàng như khách.\n\n${roleHelpHints('seller')}`
  }
  return `${name}Bạn không có quyền truy cập mục này.\n\n${roleHelpHints(ctx.role)}`
}

export function escalateReplyForRole(
  ctx: ChatContext,
  mode: 'unknown' | 'explicit' = 'unknown',
): string {
  const name = greet(ctx.userName ?? '')
  if (mode === 'explicit') {
    return `${name}Bạn có thể liên hệ hỗ trợ qua trang **Liên hệ** hoặc email **customer@sedsp.vn**.`
  }

  switch (ctx.role) {
    case 'seller':
      return `${name}Mình chưa chắc bạn muốn hỏi về **doanh số**, **tồn kho**, **DSS** hay **mua hàng như khách**.\n\nThử hỏi cụ thể, vd:\n• "Doanh thu tháng này"\n• "Sản phẩm nào sắp hết hàng"\n• "What-if giảm giá 10%"\n• "Đơn bán gần đây"`
    case 'manager':
      return `${name}Mình chưa hiểu rõ câu hỏi quản lý. Thử: **KPI tháng**, **đơn chờ duyệt**, **doanh thu sàn**, **xu hướng danh mục**.`
    case 'admin':
      return `${name}Thử hỏi: **trạng thái hệ thống**, **số user**, **cảnh báo**, **cấu hình bảo mật**.`
    case 'guest':
      return `${name}Mình chưa hiểu rõ — bạn muốn **tìm sản phẩm**, **xem giá**, hay **biết chính sách**?\n\n${roleHelpHints('guest')}\n\n👉 **Đăng nhập** để xem đơn & giỏ cá nhân.`
    default:
      return `${name}Mình chưa hiểu rõ câu hỏi — bạn muốn hỏi về **sản phẩm nào**, **giá**, **còn hàng**, **đơn hàng**, hay **đánh giá**?\n\n${roleHelpHints('customer')}`
  }
}

/** Khối prompt bổ sung cho LLM — trả lời đúng trọng tâm theo role. */
export function rolePromptBlock(role: UserRole): string {
  const focus = roleFocusLabel(role)
  const answerFirst =
    'Trả lời TRỰC TIẾP câu user vừa hỏi trước — không mở đầu bằng giới thiệu platform, không liệt kê chức năng chung, không đổi chủ đề.'
  switch (role) {
    case 'seller':
      return `${focus}\n${answerFirst}\nƯu tiên: doanh số, đơn bán, tồn kho, DSS (dự báo/giá/what-if). Chỉ tư vấn mua sắm khi user hỏi rõ tên SP/giá/mua hàng.`
    case 'manager':
      return `${focus}\n${answerFirst}\nƯu tiên: KPI, đơn chờ, doanh thu sàn, insights — không tư vấn chi tiết từng SP retail.`
    case 'guest':
      return `${focus}\n${answerFirst}\nƯu tiên: gợi ý SP, so sánh giá, voucher, chính sách. Nhắc đăng nhập khi hỏi đơn/giỏ cá nhân.`
    default:
      return `${focus}\n${answerFirst}\nƯu tiên: tư vấn SP, theo dõi đơn, review khách, voucher — không giải thích DSS nội bộ seller.`
  }
}

function humanIntentLabel(intent: ChatIntent): string {
  if (SELLER_OPS_INTENTS.has(intent)) return 'Công cụ người bán / DSS'
  if (MANAGER_OPS_INTENTS.has(intent)) return 'Báo cáo quản lý'
  if (ADMIN_OPS_INTENTS.has(intent)) return 'Quản trị hệ thống'
  return intent
}
