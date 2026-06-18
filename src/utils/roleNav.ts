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
