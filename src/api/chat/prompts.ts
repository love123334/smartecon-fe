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
        { label: 'Đơn hàng', text: 'Đơn gần đây cần xử lý?' },
        { label: 'Bán chạy', text: 'Sản phẩm nào bán chạy nhất?' },
        { label: 'Thêm SP', text: 'Làm sao để thêm sản phẩm mới?' },
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
        { label: 'Rẻ nhất', text: 'Sản phẩm nào rẻ nhất?' },
        { label: 'Dưới 2tr', text: 'Có gì dưới 2 triệu không?' },
        { label: 'Giỏ hàng', text: 'Giỏ hàng của tôi có gì?' },
        { label: 'Đơn hàng', text: 'Đơn hàng của tôi thế nào?' },
        { label: 'Người bán', text: 'Liên hệ người bán món tai nghe' },
      ]
  }
}

export function welcomeMessage(role: UserRole): string {
  switch (role) {
    case 'seller':
      return 'Xin chào! Hỏi doanh thu, tồn kho, đơn cần xử lý, SP bán chạy — tôi trả lời từ dữ liệu shop của bạn.'
    case 'manager':
      return 'Xin chào! Hỏi KPI, đơn chờ, phân khúc, what-if hoặc xu hướng — tổng hợp từ đơn hàng.'
    case 'admin':
      return 'Xin chào! Hỏi trạng thái hệ thống, số user, cảnh báo, bảo mật hoặc cấu hình.'
    case 'guest':
      return 'Xin chào! Thử "web bán gì", "sp rẻ nhất", "dưới 2 triệu", tên SP + "giá bao nhiêu". Đăng nhập để xem đơn & giỏ.'
    default:
      return 'Xin chào! Hỏi catalog, giá, tồn kho, đơn hàng, giao hàng — hoặc "what do you sell" / "cheapest product".'
  }
}
