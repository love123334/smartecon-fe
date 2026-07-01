import type { UserRole } from '@/types'

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
  return '/chatbot'
}

const PUBLIC_PREFIXES = ['/', '/search', '/products', '/login', '/register']

const ROLE_PREFIXES: Record<Exclude<UserRole, 'guest'>, string[]> = {
  customer: ['/profile', '/cart', '/checkout', '/orders', '/recommendations', '/chatbot'],
  seller: ['/seller'],
  manager: ['/manager', '/chatbot'],
  admin: ['/admin', '/chatbot'],
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
  }
  if (role === 'manager') {
    links.push({ to: '/manager/dashboard', label: 'Dashboard' })
  }
  if (role === 'admin') {
    links.push({ to: '/admin/users', label: 'Người dùng' })
  }
  return links
}

/** Shop header (promo + cart) — customer/guest hoặc ops role đang duyệt cửa hàng */
export function isShopBrowsePath(path: string): boolean {
  const browse = ['/', '/search', '/products', '/cart', '/checkout', '/orders', '/recommendations', '/profile']
  return browse.some((p) => path === p || (p !== '/' && path.startsWith(p + '/')))
}
