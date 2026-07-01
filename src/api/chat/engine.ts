import type { Product, UserRole } from '@/types'

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

export interface ChatContext {
  role: UserRole
  products?: Product[]
  userName?: string
}

function pickProducts(products: Product[] | undefined, limit = 3): Product[] {
  if (!products?.length) return []
  return products.slice(0, limit)
}

function productLines(products: Product[]): string {
  return products.map((p) => `• ${p.name} — ${formatVnd(p.price)}`).join('\n')
}

export function generateAssistantReply(text: string, ctx: ChatContext): string {
  const lower = text.toLowerCase().normalize('NFC')
  const name = ctx.userName ? `${ctx.userName}, ` : ''
  const top = pickProducts(ctx.products)

  if (ctx.role === 'customer' || ctx.role === 'guest') {
    if (/giao hàng|ship|vận chuyển|delivery/.test(lower)) {
      return `${name}SEDSP giao nội thành 1–2 ngày, ngoại tỉnh 3–5 ngày. Miễn phí đơn từ 500.000₫. Theo dõi tại **Đơn hàng của tôi**.`
    }
    if (/thanh toán|cod|chuyển khoản|payment/.test(lower)) {
      return `${name}Hỗ trợ **COD**, chuyển khoản và ví điện tử. Giá đã bao gồm VAT.`
    }
    if (/đơn hàng|order|theo dõi/.test(lower)) {
      return `${name}Vào **Đơn hàng của tôi** để xem: chờ xác nhận → đang giao → đã giao.`
    }
    if (/gợi ý|recommend|nên mua|điện tử|bán chạy|kế hoạch mua/.test(lower)) {
      if (top.length) {
        return `${name}Gợi ý dựa trên xu hướng & lịch sử:\n${productLines(top)}\n\nXem thêm tại **Gợi ý AI** hoặc hỏi chi tiết từng sản phẩm.`
      }
      return `${name}Mở **Gợi ý AI** để xem danh sách cá nhân hóa, hoặc ghé **Cửa hàng**.`
    }
    if (/giá|khuyến mãi|sale|giảm/.test(lower)) {
      return `${name}Shop đang **giảm 30%** một số mặt hàng. Xem badge Sale trên từng sản phẩm.`
    }
  }

  if (ctx.role === 'seller') {
    if (/doanh thu|bán|revenue|sales/.test(lower)) {
      return `${name}Doanh thu tháng này **+12%** so với tháng trước. Chi tiết tại **Bảng doanh số** và biểu đồ theo tháng.`
    }
    if (/tồn|kho|inventory|sku|hết hàng/.test(lower)) {
      const low = ctx.products?.filter((p) => p.stock < 20) ?? []
      if (low.length) {
        return `${name}Cảnh báo tồn kho thấp:\n${productLines(low.slice(0, 3))}\n\nNhập thêm tại **Tồn kho** hoặc xem gợi ý **DSS**.`
      }
      return `${name}Tồn kho hiện **ổn định**. DSS không báo SKU cần nhập gấp.`
    }
    if (/giá|pricing|cạnh tranh/.test(lower)) {
      return `${name}DSS gợi ý giảm **3–5%** SKU điện tử đang bán chậy để tăng chuyển đổi. Xem chi tiết tại **DSS Người bán**.`
    }
    if (/khuyến mãi|promo|flash|bundle|chiến lược|kế hoạch/.test(lower)) {
      return `${name}**Kế hoạch tuần này:**\n• Bundle phụ kiện + tai nghe (+15% AOV dự kiến)\n• Flash sale 2 SKU tồn cao\n• Gợi ý chi tiết tại **DSS** → mục Khuyến mãi chéo.`
    }
  }

  if (ctx.role === 'manager') {
    if (/kpi|dashboard|tóm tắt/.test(lower)) {
      return `${name}**KPI tháng:** GMV **+12%**, hoàn đơn **1.2%**, AOV **1.85M₫**, **8** đơn chờ xử lý. Xem **Dashboard** và **DSS Quản lý**.`
    }
    if (/phân khúc|segment|khách hàng/.test(lower)) {
      return `${name}Phân khúc GMV: **Điện tử ~45%**, Thời trang ~28%, Gia dụng ~18%. Tập trung retention nhóm điện tử.`
    }
    if (/what.?if|mô phỏng|giảm giá/.test(lower)) {
      return `${name}**What-if giảm 10%:** đơn **+18%**, biên lợi nhuận **-3%**, GMV ròng **+9%**. Mô phỏng đầy đủ tại **DSS Quản lý**.`
    }
    if (/xu hướng|tăng trưởng|danh mục|kế hoạch|dự báo/.test(lower)) {
      const cats = new Map<string, number>()
      for (const p of ctx.products ?? []) {
        cats.set(p.category, (cats.get(p.category) ?? 0) + p.soldCount)
      }
      const top = [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
      const lines = top.map(([c, n]) => `• ${c}: momentum ${n > 50 ? 'cao' : 'ổn định'}`).join('\n')
      return `${name}**Xu hướng danh mục:**\n${lines || '• Điện tử dẫn đầu doanh thu'}\n\nBiểu đồ tại **Phân tích** + DSS.`
    }
  }

  if (ctx.role === 'admin') {
    if (/hệ thống|service|trạng thái|dịch vụ/.test(lower)) {
      return `${name}**Trạng thái:** API Spring (ping thật), PostgreSQL OK, Redis ~12ms. Chi tiết **Giám sát hệ thống**.`
    }
    if (/người dùng|user|tài khoản/.test(lower)) {
      return `${name}Quản lý RBAC tại **Người dùng**: kích hoạt/khóa, đổi role. Demo có 4 account seed.`
    }
    if (/bảo mật|security|jwt|rbac/.test(lower)) {
      return `${name}JWT + RBAC, error rate 1h: **0.02%**. Không có incident bảo mật mở.`
    }
    if (/cảnh báo|alert|warn|queue|lỗi/.test(lower)) {
      return `${name}**Cảnh báo hiện tại:**\n• Order queue: **2** đơn (mức warn)\n• Error rate: **0.02%** (OK)\n• Backend API: kiểm tra realtime tại **Giám sát**.`
    }
  }

  if (/xin chào|hello|hi|chào/.test(lower)) {
    return `${name}Chọn **gợi ý nhanh** bên dưới hoặc hỏi về kế hoạch, gợi ý, KPI — tôi trả lời theo role của bạn.`
  }

  return `${name}Tôi đã ghi nhận. Hỏi cụ thể hơn (vd: "KPI tháng này", "SKU sắp hết", "gợi ý sản phẩm") hoặc dùng module **DSS / Gợi ý AI** trên menu.`
}

export function typingDelay(content: string): number {
  return Math.min(1800, Math.max(400, Math.floor(content.length * 12)))
}
