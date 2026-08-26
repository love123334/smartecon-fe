import type { UserRole } from '@/types'

export interface QuickPrompt {
  label: string
  text: string
  icon?: string
}

function usablePrompts(items: QuickPrompt[]): QuickPrompt[] {
  return items.filter((p) => p.text.trim())
}

/** Pool mua sắm cho khách hàng — đa dạng ngành hàng, ngân sách, tính năng */
const SHOPPER_PROMPT_POOL: QuickPrompt[] = [
  { label: '🎧 Tai nghe ANC', text: 'Tư vấn tai nghe bluetooth chống ồn tầm giá tốt' },
  { label: '⌨️ Bàn phím cơ', text: 'Có bàn phím cơ RGB nào đang bán chạy?' },
  { label: '🍳 Nồi chiên 5L', text: 'Tư vấn nồi chiên không dầu 5L cho gia đình' },
  { label: '👟 Giày chạy bộ', text: 'Gợi ý giày chạy bộ thể thao marathon' },
  { label: '🎟️ Mã giảm giá', text: 'Có mã voucher giảm giá nào đang áp dụng được không?' },
  { label: '🏷️ Dưới 2 triệu', text: 'Gợi ý các sản phẩm công nghệ dưới 2 triệu đồng' },
  { label: '💻 Laptop', text: 'Laptop làm việc văn phòng và đồ họa có mẫu nào?' },
  { label: '📱 Điện thoại', text: 'Điện thoại smartphone cao cấp đang có những mẫu nào?' },
  { label: '🔥 Bán chạy nhất', text: 'Sản phẩm nào đang bán chạy nhất trên sàn?' },
  { label: '🎁 Quà tặng', text: 'Gợi ý quà tặng công nghệ dưới 1 triệu' },
  { label: '📦 Đơn hàng', text: 'Đơn hàng gần nhất của tôi đang ở trạng thái nào?' },
  { label: '🛒 Giỏ hàng', text: 'Kiểm tra giỏ hàng của tôi' },
]

/** Pool quản trị và kinh doanh cho người bán (Seller DSS) */
const SELLER_PROMPT_POOL: QuickPrompt[] = [
  { label: '📋 Thống kê DSS', text: 'Thống kê giùm các chức năng cần thiết trong DSS cho shop' },
  { label: '📊 Sức khỏe shop', text: 'Đánh giá sức khỏe kinh doanh của shop tôi?' },
  { label: '📦 Cần nhập gì', text: 'Tháng tới shop nên nhập thêm những sản phẩm nào?' },
  { label: '📈 Dự báo nhu cầu', text: 'Dự báo nhu cầu bán hàng của Bàn phím cơ KeyPro K87?' },
  { label: '📉 Phân tích giảm giá', text: 'Nếu giảm giá 10% Tai nghe Bluetooth ANC thì lợi nhuận thế nào?' },
  { label: '💰 Doanh thu', text: 'Tổng quan doanh thu và đơn hàng tháng này?' },
  { label: '⚠️ Cảnh báo tồn kho', text: 'Có sản phẩm nào sắp chạm điểm đặt hàng lại (ROP) không?' },
  { label: '🏷️ Chiến lược giá', text: 'Gợi ý tối ưu giá bán cho các sản phẩm chủ lực?' },
]

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function shufflePick<T>(items: T[], count: number, seed: number): T[] {
  if (!items.length || count <= 0) return []
  const rand = mulberry32(seed || Date.now())
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, Math.min(count, copy.length))
}

/** Mỗi lần gọi với seed khác → bộ chip khác (mặc định 4 nút). */
export function pickQuickPrompts(
  role: UserRole,
  seed: number = Date.now(),
  count = 4,
): QuickPrompt[] {
  switch (role) {
    case 'seller':
      return shufflePick(usablePrompts(SELLER_PROMPT_POOL), count, seed)
    case 'manager':
      return shufflePick(
        [
          { label: '📊 KPI sàn', text: 'Tóm tắt KPI và hiệu suất toàn sàn tháng này' },
          { label: '⏳ Đơn chờ', text: 'Có bao nhiêu đơn hàng đang chờ xử lý?' },
          { label: '📈 Xu hướng', text: 'Danh mục nào đang có tăng trưởng doanh thu cao nhất?' },
          { label: '💰 Doanh thu GMV', text: 'Tổng doanh thu GMV và phí sàn hiện tại?' },
          { label: '🎟️ Hiệu quả Voucher', text: 'Voucher nào đang có tỷ lệ sử dụng cao nhất?' },
        ],
        count,
        seed,
      )
    case 'admin':
      return shufflePick(
        [
          { label: '🖥️ Hệ thống', text: 'Trạng thái các dịch vụ hệ thống và database?' },
          { label: '👥 Người dùng', text: 'Thống kê người dùng và tài khoản mới đăng ký?' },
          { label: '⚠️ Cảnh báo', text: 'Có cảnh báo bảo mật hoặc vận hành nào không?' },
        ],
        count,
        seed,
      )
    default:
      return shufflePick(usablePrompts(SHOPPER_PROMPT_POOL), count, seed)
  }
}

export function quickPromptsForRole(role: UserRole): QuickPrompt[] {
  return pickQuickPrompts(role, 0, 12)
}

export function welcomeMessage(role: UserRole, userName?: string): string {
  const name = userName?.trim() ? ` ${userName}` : ''
  if (role === 'seller') {
    return `Xin chào${name}! 👋 Tôi là Trợ lý DSS & Quản lý bán hàng của bạn.`
  }
  if (role === 'manager') {
    return `Xin chào${name}! Tôi là Trợ lý Quản trị Vận hành sàn của bạn.`
  }
  return `Xin chào${name}! 👋 Tôi là Trợ lý mua sắm SEDSP của bạn.`
}
