import type { UserRole } from '@/types'

export interface QuickPrompt {
  label: string
  text: string
  /** Hiển thị nhưng không gửi chat (module đã bỏ khỏi trợ lý) */
  disabled?: boolean
}

export function quickPromptsForRole(role: UserRole): QuickPrompt[] {
  switch (role) {
    case 'seller':
      return [
        { label: 'Doanh số', text: 'Doanh thu tháng này thế nào?' },
        { label: 'Đơn mua', text: 'Đơn mua của tôi thế nào?' },
        { label: 'Mua hàng', text: 'Gợi ý sản phẩm đang bán chạy để nhập / mua?' },
        // Chỉ hiện, không bấm — bỏ khỏi trọng tâm trợ lý
        { label: 'Tồn kho', text: '', disabled: true },
        { label: 'DSS bán hàng', text: '', disabled: true },
        { label: 'What-if', text: '', disabled: true },
      ]
    case 'manager':
      return [
        { label: 'KPI', text: 'Tóm tắt KPI tháng này' },
        { label: 'Đơn chờ', text: 'Có bao nhiêu đơn chờ xử lý?' },
        { label: 'Xu hướng', text: 'Danh mục nào đang tăng trưởng?' },
        { label: 'Doanh thu', text: 'Doanh thu GMV hiện tại?' },
      ]
    case 'admin':
      return [
        { label: 'Hệ thống', text: 'Trạng thái các dịch vụ hệ thống?' },
        { label: 'Người dùng', text: 'Có bao nhiêu tài khoản đang hoạt động?' },
        { label: 'Cảnh báo', text: 'Có cảnh báo vận hành nào không?' },
        { label: 'Bảo mật', text: 'Tóm tắt bảo mật JWT và RBAC' },
        { label: 'Cấu hình', text: 'Các biến môi trường cần cấu hình?' },
      ]
    case 'guest':
      return [
        { label: 'Web bán gì', text: 'Web bán gì vậy?' },
        { label: 'Điện thoại', text: 'Điện thoại có gì?' },
        { label: 'Rẻ nhất', text: 'Sản phẩm nào rẻ nhất?' },
        { label: 'Dưới 2tr', text: 'Có gì dưới 2 triệu không?' },
      ]
    default:
      return [
        { label: 'Web bán gì', text: 'Web bán gì vậy?' },
        { label: 'Điện thoại', text: 'Điện thoại có gì?' },
        { label: 'Rẻ nhất', text: 'Sản phẩm nào rẻ nhất?' },
        { label: 'Dưới 2tr', text: 'Có gì dưới 2 triệu không?' },
        { label: 'Giỏ hàng', text: 'Giỏ hàng của tôi có gì?' },
        { label: 'Đơn hàng', text: 'Đơn hàng của tôi thế nào?' },
      ]
  }
}

export function welcomeMessage(role: UserRole): string {
  switch (role) {
    case 'seller':
      return 'Xin chào! Hỏi **doanh số**, **đơn mua** hoặc **mua hàng**. Các module tồn kho / DSS / what-if dùng trang DSS riêng.'
    case 'manager':
      return 'Xin chào! Hỏi KPI, đơn chờ, phân khúc hoặc xu hướng danh mục.'
    case 'admin':
      return 'Xin chào! Hỏi trạng thái hệ thống, số user, cảnh báo, bảo mật hoặc cấu hình.'
    case 'guest':
      return 'Xin chào! Thử "web bán gì", "điện thoại", "sp rẻ nhất", "dưới 2 triệu". Đăng nhập để xem đơn & giỏ.'
    default:
      return 'Xin chào! Hỏi catalog, giá, tồn kho, đơn hàng — hoặc tên SP + "giá bao nhiêu".'
  }
}
