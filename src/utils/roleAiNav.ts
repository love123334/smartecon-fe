import type { UserRole } from '@/types'

export interface NavLink {
  to: string
  label: string
  highlight?: boolean
}

/** Route chatbot đúng role */
export function roleChatPath(role: UserRole): string {
  return role === 'seller' ? '/seller/chatbot' : '/chatbot'
}

/** Route gợi ý / DSS chính theo role */
export function roleInsightsPath(role: UserRole): string | null {
  switch (role) {
    case 'customer':
      return '/recommendations'
    case 'seller':
      return '/seller/dss'
    case 'manager':
      return '/manager/dss'
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
        { to: '/recommendations', label: 'Gợi ý AI sản phẩm', highlight: true },
        { to: '/chatbot', label: 'Chatbot tư vấn' },
        { to: '/orders', label: 'Đơn hàng của tôi' },
        { to: '/cart', label: 'Giỏ hàng' },
      ]
    case 'seller':
      return [
        { to: '/seller/dss', label: 'DSS — Kế hoạch bán hàng', highlight: true },
        { to: '/seller/chatbot', label: 'Trợ lý AI người bán' },
        { to: '/seller/sales', label: 'Bảng doanh số' },
        { to: '/seller/inventory', label: 'Tồn kho' },
        { to: '/seller/products', label: 'Quản lý sản phẩm' },
      ]
    case 'manager':
      return [
        { to: '/manager/dashboard', label: 'Dashboard KPI' },
        { to: '/manager/dss', label: 'DSS & what-if', highlight: true },
        { to: '/manager/analytics', label: 'Phân tích danh mục' },
        { to: '/chatbot', label: 'Trợ lý AI quản lý' },
      ]
    case 'admin':
      return [
        { to: '/admin/users', label: 'Quản lý người dùng' },
        { to: '/admin/monitoring', label: 'Giám sát hệ thống' },
        { to: '/chatbot', label: 'Trợ lý AI admin', highlight: true },
      ]
    default:
      return []
  }
}

/** Shortcut trên trang chat — liên kết module AI/DSS liên quan */
export function roleChatShortcuts(role: UserRole): NavLink[] {
  switch (role) {
    case 'customer':
      return [
        { to: '/recommendations', label: 'Gợi ý sản phẩm' },
        { to: '/search', label: 'Cửa hàng' },
        { to: '/orders', label: 'Đơn hàng' },
      ]
    case 'seller':
      return [
        { to: '/seller/dss', label: 'DSS bán hàng' },
        { to: '/seller/sales', label: 'Doanh số' },
        { to: '/seller/inventory', label: 'Tồn kho' },
      ]
    case 'manager':
      return [
        { to: '/manager/dss', label: 'DSS quản lý' },
        { to: '/manager/dashboard', label: 'Dashboard' },
        { to: '/manager/analytics', label: 'Phân tích' },
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

/** Footer bổ sung — module AI/DSS (không trùng Liên hệ/chatbot) */
export function roleAiFooterLinks(role: UserRole): NavLink[] {
  switch (role) {
    case 'customer':
      return [{ to: '/recommendations', label: 'Gợi ý AI' }]
    case 'seller':
      return [{ to: '/seller/dss', label: 'DSS bán hàng' }]
    case 'manager':
      return [{ to: '/manager/dss', label: 'DSS quản lý' }]
    default:
      return []
  }
}

/** Category nav — link AI phù hợp role (guest → login) */
export function roleCategoryAiLink(role: UserRole, isLoggedIn: boolean): NavLink {
  if (!isLoggedIn) {
    return { to: '/login?redirect=/recommendations', label: 'Gợi ý AI' }
  }
  if (role === 'customer') {
    return { to: '/recommendations', label: 'Gợi ý AI' }
  }
  if (role === 'seller') {
    return { to: '/seller/dss', label: 'DSS & AI' }
  }
  if (role === 'manager') {
    return { to: '/manager/dss', label: 'DSS & AI' }
  }
  return { to: '/chatbot', label: 'Trợ lý AI' }
}

/** FAB hiển thị khi không đang ở trang chat */
export function isChatPage(path: string): boolean {
  return path === '/chatbot' || path.startsWith('/seller/chatbot')
}
