import type { UserRole } from '@/types'

export interface QuickPrompt {
  label: string
  text: string
}

export function quickPromptsForRole(role: UserRole): QuickPrompt[] {
  switch (role) {
    case 'seller':
      return [
        { label: 'Doanh thu', text: 'Doanh thu tháng này thế nào?' },
        { label: 'Tồn kho', text: 'SKU nào sắp hết hàng?' },
        { label: 'Khuyến mãi', text: 'Kế hoạch khuyến mãi tuần này' },
        { label: 'Thêm SP', text: 'Làm sao để thêm sản phẩm mới?' },
        { label: 'Giá', text: 'Gợi ý điều chỉnh giá sản phẩm bán chậm' },
      ]
    case 'manager':
      return [
        { label: 'KPI', text: 'Tóm tắt KPI tháng này' },
        { label: 'Đơn chờ', text: 'Có bao nhiêu đơn chờ xử lý?' },
        { label: 'What-if', text: 'Mô phỏng giảm giá 10% thì sao?' },
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
    default:
      return [
        { label: 'Web bán gì', text: 'Web bán gì vậy?' },
        { label: 'Giỏ hàng', text: 'Giỏ hàng của tôi có gì?' },
        { label: 'Đơn hàng', text: 'Đơn hàng của tôi thế nào?' },
        { label: 'Danh mục', text: 'Điện tử có những sản phẩm gì?' },
        { label: 'Liên hệ', text: 'Chuyển sang liên hệ quản lý giúp tôi' },
      ]
  }
}

export function welcomeMessage(role: UserRole): string {
  switch (role) {
    case 'seller':
      return 'Xin chào! Hỏi về doanh thu, tồn kho, giá, khuyến mãi hoặc cách thêm sản phẩm — tôi trả lời dựa trên dữ liệu shop của bạn.'
    case 'manager':
      return 'Xin chào! Hỏi KPI, đơn chờ, phân khúc, what-if hoặc xu hướng danh mục — tôi tổng hợp từ dữ liệu đơn hàng.'
    case 'admin':
      return 'Xin chào! Hỏi trạng thái hệ thống, số user, cảnh báo, bảo mật hoặc cấu hình môi trường.'
    case 'guest':
      return 'Xin chào! Hỏi "web bán gì", sản phẩm, giao hàng, thanh toán. Đăng nhập để xem đơn hàng và gợi ý cá nhân.'
    default:
      return 'Xin chào! Hỏi "web bán gì", tên SP, đơn hàng, giao hàng, thanh toán — hoặc "what do you sell" (tiếng Anh).'
  }
}
