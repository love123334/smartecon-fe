import type { UserRole } from '@/types'

export interface NavLink {
  to: string
  label: string
  highlight?: boolean
}

/** Route chatbot đúng role */
export function roleChatPath(role: UserRole): string {
  if (role === 'seller') return '/seller/chatbot'
  if (role === 'admin') return '/admin/monitoring'
  return '/chatbot'
}

/** Route gợi ý / DSS chính theo role */
export function roleInsightsPath(role: UserRole): string | null {
  switch (role) {
    case 'customer':
      return '/recommendations'
    case 'seller':
      return '/seller/dss'
    case 'manager':
      return '/manager/dashboard'
    default:
      return null
  }
}

/** Menu account hover — đủ chức năng demo theo role */
export function roleAccountMenuLinks(role: UserRole): NavLink[] {
  switch (role) {
    case 'customer':
      return [
        { to: '/profile', label: 'Hồ sơ & avatar' },
        { to: '/orders', label: 'Lịch sử mua hàng' },
        { to: '/cart', label: 'Giỏ hàng' },
      ]
    case 'seller':
      return [
        { to: '/profile', label: 'Hồ sơ & avatar' },
        { to: '/seller/dss', label: 'DSS — Kế hoạch bán hàng', highlight: true },
        { to: '/seller/dss/demand', label: 'Dự báo nhu cầu' },
        { to: '/seller/dss/price', label: 'Gợi ý giá' },
        { to: '/seller/dss/what-if', label: 'What-if giảm giá', highlight: true },
        { to: '/seller/sales', label: 'Bảng doanh số' },
        { to: '/seller/orders', label: 'Đơn bán' },
        { to: '/seller/inventory', label: 'Tồn kho' },
        { to: '/seller/products', label: 'Quản lý sản phẩm' },
      ]
    case 'manager':
      return [
        { to: '/manager/dashboard', label: 'Dashboard · Doanh thu sàn', highlight: true },
      ]
    case 'admin':
      return [
        { to: '/admin/users', label: 'Quản lý người dùng' },
        { to: '/admin/monitoring', label: 'Giám sát hệ thống' },
      ]
    default:
      return []
  }
}

/** Shortcut trên trang chat — liên kết module liên quan (seller: mua/đơn/doanh số) */
export function roleChatShortcuts(role: UserRole): NavLink[] {
  switch (role) {
    case 'customer':
      return [
        { to: '/search', label: 'Cửa hàng' },
        { to: '/orders', label: 'Đơn hàng' },
      ]
    case 'seller':
      return [
        { to: '/seller/dss/what-if', label: 'What-if giảm giá' },
        { to: '/seller/sales', label: 'Doanh số' },
        { to: '/orders', label: 'Đơn mua' },
      ]
    case 'manager':
      return [
        { to: '/manager/dashboard', label: 'Dashboard · Doanh thu' },
      ]
    case 'admin':
      return [
        { to: '/admin/monitoring', label: 'Giám sát' },
        { to: '/admin/users', label: 'Người dùng' },
      ]
    default:
      return []
  }
}

/** Footer bổ sung — không còn trang gợi ý AI / chatbot riêng */
export function roleAiFooterLinks(role: UserRole): NavLink[] {
  switch (role) {
    case 'seller':
      return [{ to: '/seller/dss', label: 'DSS bán hàng' }]
    case 'manager':
      return [{ to: '/manager/dashboard', label: 'Dashboard' }]
    default:
      return []
  }
}

/** Category nav — mở trợ lý qua FAB (không còn trang gợi ý AI) */
export function roleCategoryAiLink(role: UserRole, isLoggedIn: boolean): NavLink {
  if (!isLoggedIn) {
    return { to: '/search', label: 'Cửa hàng' }
  }
  if (role === 'seller') {
    return { to: '/seller/dss', label: 'DSS & AI' }
  }
  if (role === 'manager') {
    return { to: '/manager/dashboard', label: 'Dashboard' }
  }
  if (role === 'admin') {
    return { to: '/admin/monitoring', label: 'Giám sát' }
  }
  return { to: '/search', label: 'Cửa hàng' }
}

/** FAB hiển thị khi không đang ở trang chat */
export function isChatPage(path: string): boolean {
  return path === '/chatbot' || path.startsWith('/seller/chatbot')
}
