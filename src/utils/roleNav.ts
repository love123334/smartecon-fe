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

/** Trang liên hệ / góp ý (không mở chatbot) */
export function roleContactPath(_role: UserRole): string {
  return '/contact'
}

const PUBLIC_PREFIXES = [
  '/',
  '/search',
  '/products',
  '/login',
  '/register',
  '/payment',
  '/contact',
  '/privacy',
  '/terms',
]

const ROLE_PREFIXES: Record<Exclude<UserRole, 'guest'>, string[]> = {
  customer: ['/profile', '/role-upgrade', '/cart', '/checkout', '/payment', '/orders', '/chatbot'],
  seller: [
    '/seller',
    '/profile',
    '/orders',
    '/cart',
    '/checkout',
    '/search',
  ],
  manager: ['/manager', '/chatbot'],
  admin: ['/admin'],
}

/** Strip query/hash so `/cart?pay=cancelled` still matches `/cart`. */
function pathOnly(path: string): string {
  const raw = (path || '/').trim()
  const noHash = raw.split('#')[0] ?? raw
  const noQuery = noHash.split('?')[0] ?? noHash
  return noQuery || '/'
}

export function isPathAllowedForRole(role: UserRole, path: string): boolean {
  const clean = pathOnly(path)
  if (PUBLIC_PREFIXES.some((p) => clean === p || (p !== '/' && clean.startsWith(p + '/')))) {
    return true
  }
  if (role === 'guest') return false
  return ROLE_PREFIXES[role].some((p) => clean === p || clean.startsWith(p + '/'))
}

/** Sau login: ưu tiên redirect hợp lệ, không thì về home theo role */
export function resolvePostLoginPath(role: UserRole, redirect?: string): string {
  if (redirect && isPathAllowedForRole(role, redirect)) {
    // Preserve query (e.g. /cart?pay=cancelled) when present
    return redirect.startsWith('/') ? redirect : `/${redirect}`
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
    links.push({ to: '/seller/momo-settings', label: 'MoMo shop' })
  }
  if (role === 'manager') {
    links.push({ to: '/manager/dashboard', label: 'Dashboard' })
  }
  if (role === 'admin') {
    links.push({ to: '/admin/users', label: 'Người dùng' })
    links.push({ to: '/admin/monitoring', label: 'Giám sát' })
  }
  return links
}

/** Shop header (promo + cart) — customer/guest hoặc ops role đang duyệt cửa hàng */
export function isShopBrowsePath(path: string): boolean {
  const browse = ['/', '/search', '/products', '/cart', '/checkout', '/orders', '/profile', '/role-upgrade']
  return browse.some((p) => path === p || (p !== '/' && path.startsWith(p + '/')))
}
