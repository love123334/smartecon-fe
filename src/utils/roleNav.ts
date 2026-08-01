import type { UserRole } from '@/types'

/** Customer được mua hàng (giỏ, checkout, đơn mua, đánh giá). Seller không dùng giỏ hàng. */
export function canShopAsBuyer(role: UserRole | null | undefined): boolean {
  return role === 'customer'
}

/** Trang chủ chế độ vận hành theo role (seller/manager/admin) */
export function roleOpsHome(role: UserRole): string | null {
  switch (role) {
    case 'seller':
      return '/seller/products'
    case 'manager':
      return '/manager/dashboard'
    case 'admin':
      return '/admin/users'
    default:
      return null
  }
}

export function roleHomePath(role: UserRole): string {
  return roleOpsHome(role) ?? '/'
}

export function roleOpsHomeLabel(role: UserRole): string {
  switch (role) {
    case 'seller':
      return '← Bảng người bán'
    case 'manager':
      return '← Dashboard'
    case 'admin':
      return '← Quản trị'
    default:
      return '← Quay lại'
  }
}

/** Trang trợ lý AI / liên hệ phù hợp từng role */
export function roleContactPath(role: UserRole): string {
  if (role === 'seller') return '/seller/chatbot'
  if (role === 'admin') return '/admin/monitoring'
  return '/chatbot'
}

const PUBLIC_PREFIXES = ['/', '/search', '/products', '/login', '/register']

const ROLE_PREFIXES: Record<Exclude<UserRole, 'guest'>, string[]> = {
  customer: ['/profile', '/role-upgrade', '/cart', '/checkout', '/payment', '/orders', '/recommendations', '/chatbot'],
  seller: [
    '/seller',
    '/profile',
  ],
  manager: ['/manager', '/chatbot'],
  admin: ['/admin'],
}

export function isPathAllowedForRole(role: UserRole, path: string): boolean {
  if (PUBLIC_PREFIXES.some((p) => path === p || (p !== '/' && path.startsWith(p + '/')))) {
    return true
  }
  if (role === 'guest') return false
  return ROLE_PREFIXES[role].some((p) => path === p || path.startsWith(p + '/'))
}

/** Sau login: ưu tiên redirect hợp lệ, không thì về home theo role */
export function resolvePostLoginPath(role: UserRole, redirect?: string): string {
  if (redirect && isPathAllowedForRole(role, redirect)) {
    return redirect
  }
  return roleHomePath(role)
}

export interface FooterLink {
  to: string
  label: string
}

export function footerLinksForRole(role: UserRole): FooterLink[] {
  const links: FooterLink[] = [
    { to: '/', label: 'Trang chủ' },
    { to: '/search', label: 'Cửa hàng' },
    { to: roleContactPath(role), label: 'Liên hệ' },
  ]
  if (role === 'customer') {
    links.push({ to: '/orders', label: 'Đơn hàng' })
  }
  if (role === 'seller') {
    links.push({ to: '/seller/products', label: 'Quản lý SP' })
    links.push({ to: '/seller/orders', label: 'Đơn bán' })
  }
  if (role === 'manager') {
    links.push({ to: '/manager/dashboard', label: 'Dashboard' })
    links.push({ to: '/manager/platform-revenue', label: 'Doanh thu sàn' })
    links.push({ to: '/manager/analytics', label: 'Phân tích' })
    links.push({ to: '/manager/dss', label: 'DSS' })
  }
  if (role === 'admin') {
    links.push({ to: '/admin/users', label: 'Người dùng' })
    links.push({ to: '/admin/monitoring', label: 'Giám sát' })
  }
  return links
}

/** Shop header (promo + cart) — customer/guest hoặc ops role đang duyệt cửa hàng */
export function isShopBrowsePath(path: string): boolean {
  const browse = ['/', '/search', '/products', '/cart', '/checkout', '/orders', '/recommendations', '/profile', '/role-upgrade']
  return browse.some((p) => path === p || (p !== '/' && path.startsWith(p + '/')))
}
