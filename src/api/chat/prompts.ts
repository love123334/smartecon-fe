import type { UserRole } from '@/types'

export interface QuickPrompt {
  label: string
  text: string
}

function usablePrompts(items: QuickPrompt[]): QuickPrompt[] {
  return items.filter((p) => p.text.trim())
}

/** Pool mua sắm — xoay vòng/random mỗi lần mở chat để kích thích khám phá. */
const SHOPPER_PROMPT_POOL: QuickPrompt[] = [
  { label: 'Web bán gì', text: 'Web bán gì vậy?' },
  { label: 'Điện thoại', text: 'Điện thoại có gì?' },
  { label: 'Laptop', text: 'Laptop đang bán những gì?' },
  { label: 'Tai nghe', text: 'Tai nghe bluetooth có gì hay?' },
  { label: 'Bàn phím', text: 'Bàn phím cơ đang có những mẫu nào?' },
  { label: 'Rẻ nhất', text: 'Sản phẩm nào rẻ nhất?' },
  { label: 'Dưới 2tr', text: 'Có gì dưới 2 triệu không?' },
  { label: 'Dưới 500k', text: 'Có sản phẩm dưới 500 nghìn không?' },
  { label: 'Tầm 1–3tr', text: 'Gợi ý sản phẩm từ 1 đến 3 triệu' },
  { label: 'Trên 10tr', text: 'Sản phẩm trên 10 triệu có gì?' },
  { label: 'Đang hot', text: 'Sản phẩm bán chạy nhất là gì?' },
  { label: 'Thể thao', text: 'Đồ thể thao / giày chạy có gì?' },
  { label: 'Gia dụng', text: 'Gia dụng nhà bếp đang bán gì?' },
  { label: 'Quà tặng', text: 'Gợi ý quà tặng dưới 1 triệu' },
  { label: 'Phụ kiện', text: 'Phụ kiện điện tử đang có những gì?' },
  { label: 'Máy tính bảng', text: 'Máy tính bảng / tablet có gì?' },
  { label: 'So sánh', text: 'So sánh giúp tai nghe và bàn phím tầm giá' },
  { label: 'Deal hôm nay', text: 'Hôm nay nên mua gì hợp túi tiền?' },
]

const CUSTOMER_EXTRA: QuickPrompt[] = [
  { label: 'Giỏ hàng', text: 'Giỏ hàng của tôi có gì?' },
  { label: 'Đơn hàng', text: 'Đơn hàng của tôi thế nào?' },
  { label: 'Theo dõi đơn', text: 'Đơn gần nhất của tôi đang ở đâu?' },
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
      return shufflePick(
        usablePrompts([
          { label: 'Doanh số', text: 'Doanh thu tháng này thế nào?' },
          { label: 'Đơn mua', text: 'Đơn mua của tôi thế nào?' },
          { label: 'Mua hàng', text: 'Gợi ý sản phẩm đang bán chạy để nhập / mua?' },
          { label: 'Tồn kho', text: 'Sản phẩm nào sắp hết hàng?' },
          { label: 'What-if', text: 'What if giảm giá 10% thì sao?' },
          { label: 'Giá bán', text: 'Nên giữ hay giảm giá sản phẩm bán chạy?' },
          { label: 'Dự báo', text: 'Dự báo nhu cầu tuần tới thế nào?' },
        ]),
        count,
        seed,
      )
    case 'manager':
      return shufflePick(
        [
          { label: 'KPI', text: 'Tóm tắt KPI tháng này' },
          { label: 'Đơn chờ', text: 'Có bao nhiêu đơn chờ xử lý?' },
          { label: 'Xu hướng', text: 'Danh mục nào đang tăng trưởng?' },
          { label: 'Doanh thu', text: 'Doanh thu GMV hiện tại?' },
          { label: 'Voucher', text: 'Voucher nào đang chạy tốt?' },
        ],
        count,
        seed,
      )
    case 'admin':
      return shufflePick(
        [
          { label: 'Hệ thống', text: 'Trạng thái các dịch vụ hệ thống?' },
          { label: 'Người dùng', text: 'Có bao nhiêu tài khoản đang hoạt động?' },
          { label: 'Cảnh báo', text: 'Có cảnh báo vận hành nào không?' },
          { label: 'Bảo mật', text: 'Tóm tắt bảo mật JWT và RBAC' },
          { label: 'Cấu hình', text: 'Các biến môi trường cần cấu hình?' },
        ],
        count,
        seed,
      )
    case 'guest':
      return shufflePick(SHOPPER_PROMPT_POOL, count, seed)
    default:
      return shufflePick([...SHOPPER_PROMPT_POOL, ...CUSTOMER_EXTRA], count, seed)
  }
}

/** @deprecated dùng pickQuickPrompts — giữ tương thích test/cũ */
export function quickPromptsForRole(role: UserRole): QuickPrompt[] {
  return pickQuickPrompts(role, Date.now(), 4)
}

export function welcomeMessage(role: UserRole): string {
  switch (role) {
    case 'seller':
      return 'Xin chào! Hỏi **doanh thu**, **đơn bán**, **tồn kho**, **DSS** hoặc **what-if** — mình trả lời từ dữ liệu shop và có nút mở trang trực quan nếu bạn muốn.'
    case 'manager':
      return 'Xin chào! Hỏi KPI, đơn chờ, phân khúc hoặc xu hướng danh mục.'
    case 'admin':
      return 'Xin chào! Hỏi trạng thái hệ thống, số user, cảnh báo, bảo mật hoặc cấu hình.'
    case 'guest':
      return 'Xin chào! Thử hỏi catalog, giá, danh mục — hoặc bấm gợi ý phía trên. Đăng nhập để xem đơn & giỏ.'
    default:
      return 'Xin chào! Hỏi catalog, giá, tồn kho, đơn hàng — hoặc tên SP + "giá bao nhiêu".'
  }
}
