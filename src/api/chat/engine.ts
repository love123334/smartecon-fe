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
      return `${name}SEDSP giao nội thành 1–2 ngày, ngoại tỉnh 3–5 ngày. Miễn phí đơn từ 500.000₫. Bạn có thể theo dõi trạng thái tại mục **Đơn hàng của tôi**.`
    }
    if (/thanh toán|cod|chuyển khoản|payment/.test(lower)) {
      return `${name}Hỗ trợ **COD**, chuyển khoản và ví điện tử. Giá đã bao gồm VAT. Sau khi đặt hàng bạn nhận mã theo dõi qua email.`
    }
    if (/đơn hàng|order|theo dõi/.test(lower)) {
      return `${name}Vào **Đơn hàng của tôi** để xem trạng thái: chờ xác nhận → đang giao → đã giao.`
    }
    if (/gợi ý|recommend|nên mua|điện tử|bán chạy/.test(lower)) {
      if (top.length) {
        return `${name}Một vài sản phẩm đang được quan tâm:\n${productLines(top)}\n\nBạn muốn xem chi tiết sản phẩm nào?`
      }
      return `${name}Hãy ghé **Cửa hàng** để xem danh mục mới nhất.`
    }
    if (/giá|khuyến mãi|sale|giảm/.test(lower)) {
      return `${name}Shop đang có chương trình **giảm 30%** một số mặt hàng.`
    }
  }

  if (ctx.role === 'seller') {
    if (/doanh thu|bán|revenue|sales/.test(lower)) {
      return `${name}Doanh thu tháng này **+12%** so với tháng trước. Xem **Doanh số**.`
    }
    if (/tồn|kho|inventory|sku|hết hàng/.test(lower)) {
      const low = ctx.products?.filter((p) => p.stock < 20) ?? []
      if (low.length) {
        return `${name}Cảnh báo tồn kho:\n${productLines(low.slice(0, 3))}\n\nKiểm tra **Tồn kho**.`
      }
      return `${name}Tồn kho hiện **ổn định**.`
    }
    if (/giá|pricing/.test(lower)) {
      return `${name}DSS gợi ý giảm **3–5%** một số SKU điện tử để tăng chuyển đổi.`
    }
  }

  if (ctx.role === 'manager') {
    if (/kpi|dashboard/.test(lower)) {
      return `${name}GMV **+12%**, hoàn đơn **1.2%**, AOV **1.85M₫**.`
    }
    if (/phân khúc|segment/.test(lower)) {
      return `${name}Nhóm **điện tử** ~45% GMV, **thời trang** ~28%.`
    }
    if (/what.?if|mô phỏng|giảm giá/.test(lower)) {
      return `${name}Giảm giá **10%**: đơn **+18%**, biên **-3%**. Xem **DSS Quản lý**.`
    }
  }

  if (ctx.role === 'admin') {
    if (/hệ thống|service|trạng thái/.test(lower)) {
      return `${name}API **99.9%**, PostgreSQL OK, Redis **~12ms**. Xem **Giám sát**.`
    }
    if (/người dùng|user/.test(lower)) {
      return `${name}Quản lý user tại **Người dùng**. Có 4 tài khoản demo seed sẵn.`
    }
    if (/bảo mật|security/.test(lower)) {
      return `${name}JWT + RBAC, error rate 1h: **0.02%**.`
    }
  }

  if (/xin chào|hello|hi|chào/.test(lower)) {
    return `${name}Chọn gợi ý nhanh bên dưới hoặc đặt câu hỏi tự do.`
  }

  return `${name}Tôi đã ghi nhận câu hỏi — hỏi thêm chi tiết nếu cần nhé.`
}

export function typingDelay(content: string): number {
  return Math.min(1800, Math.max(400, Math.floor(content.length * 12)))
}
