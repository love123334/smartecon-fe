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
        { label: 'Giá cạnh tranh', text: 'Gợi ý điều chỉnh giá sản phẩm' },
        { label: 'Khuyến mãi', text: 'Chiến lược khuyến mãi tuần này' },
      ]
    case 'manager':
      return [
        { label: 'KPI', text: 'Tóm tắt KPI tháng này' },
        { label: 'Phân khúc', text: 'Phân khúc khách hàng nào đóng góp nhiều nhất?' },
        { label: 'What-if', text: 'Mô phỏng giảm giá 10% thì sao?' },
        { label: 'Xu hướng', text: 'Danh mục nào đang tăng trưởng?' },
      ]
    case 'admin':
      return [
        { label: 'Hệ thống', text: 'Trạng thái các dịch vụ hệ thống?' },
        { label: 'Người dùng', text: 'Có bao nhiêu tài khoản đang hoạt động?' },
        { label: 'Cảnh báo', text: 'Có cảnh báo vận hành nào không?' },
        { label: 'Bảo mật', text: 'Tóm tắt log bảo mật gần đây' },
      ]
    default:
      return [
        { label: 'Giao hàng', text: 'Chính sách giao hàng và phí ship?' },
        { label: 'Thanh toán', text: 'Có những hình thức thanh toán nào?' },
        { label: 'Đơn hàng', text: 'Làm sao để theo dõi đơn hàng?' },
        { label: 'Gợi ý SP', text: 'Gợi ý sản phẩm điện tử bán chạy' },
      ]
  }
}

export function welcomeMessage(role: UserRole): string {
  switch (role) {
    case 'seller':
      return 'Xin chào! Tôi là trợ lý bán hàng SEDSP — hỏi về doanh thu, tồn kho, giá hoặc DSS.'
    case 'manager':
      return 'Xin chào! Tôi hỗ trợ phân tích KPI, phân khúc khách hàng và kịch bản what-if.'
    case 'admin':
      return 'Xin chào! Tôi hỗ trợ giám sát hệ thống, người dùng và vận hành nền tảng.'
    default:
      return 'Xin chào! Tôi có thể tư vấn sản phẩm, đơn hàng, giao hàng và khuyến mãi.'
  }
}
