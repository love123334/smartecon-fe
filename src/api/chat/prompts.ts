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
        { label: 'Dự báo cầu', text: 'Dự báo nhu cầu 30 ngày tới?' },
        { label: 'Giá DSS', text: 'Khuyến nghị giá cho SP bán chạy?' },
        { label: 'What-if', text: 'What-if giảm giá 10% thì lợi nhuận ra sao?' },
        { label: 'Tồn kho', text: 'Khuyến nghị tồn kho SKU nào cần nhập?' },
        { label: 'Đơn mua', text: 'Đơn mua của tôi thế nào?' },
      ]
    case 'manager':
      return [
        { label: 'KPI', text: 'Tóm tắt KPI tháng này' },
        { label: 'Đơn chờ', text: 'Có bao nhiêu đơn chờ xử lý?' },
        { label: 'What-if', text: 'Mô phỏng khuyến mãi giảm 10% thì sao?' },
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
      return 'Xin chào! Hỏi doanh thu, DSS (nhu cầu / giá / tồn / what-if), đơn bán hoặc **đơn mua** khi bạn mua như khách.'
    case 'manager':
      return 'Xin chào! Hỏi KPI, đơn chờ, phân khúc, what-if khuyến mãi hoặc xu hướng danh mục.'
    case 'admin':
      return 'Xin chào! Hỏi trạng thái hệ thống, số user, cảnh báo, bảo mật hoặc cấu hình.'
    case 'guest':
      return 'Xin chào! Thử "web bán gì", "điện thoại có gì", "sp rẻ nhất", "dưới 2 triệu". Đăng nhập để xem đơn & giỏ.'
    default:
      return 'Xin chào! Hỏi catalog (danh mục VI), giá, tồn kho, đơn hàng, giao hàng — hoặc tên SP + "giá bao nhiêu".'
  }
}
