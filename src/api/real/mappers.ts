import type { User, UserRole } from '@/types'
import { findSeedUserByEmail, resolveCatalogUserId } from '@/api/mockData'

/** Backend role enum → FE lowercase role */
export function mapApiRole(role?: string | null): UserRole {
  if (!role) return 'customer'
  const r = role.toUpperCase()
  if (r === 'ADMIN') return 'admin'
  if (r === 'MANAGER') return 'manager'
  if (r === 'SELLER') return 'seller'
  return 'customer'
}

export interface BackendLoginResponse {
  tokenType: string
  accessToken: string
  expiresInSeconds: number
  user: {
    id: number
    email: string
    username?: string
    role: string
  }
}

export interface BackendMeResponse {
  id: number
  email: string
  username?: string
  fullName?: string
  phone?: string
  role: string
}

export interface BackendUserProfileResponse {
  id: number
  username?: string
  email: string
  fullName?: string
  phone?: string
  role: string
  status?: string
}

export function mapBackendUser(
  data: BackendMeResponse | BackendUserProfileResponse,
): User {
  const seed = findSeedUserByEmail(data.email)
  const phone = 'phone' in data ? data.phone : undefined
  const status = 'status' in data ? data.status : undefined
  const role = data.role ? mapApiRole(data.role) : (seed?.role ?? 'customer')

  return {
    id: resolveCatalogUserId(data.email, data.id),
    backendId: String(data.id),
    email: data.email,
    fullName: data.fullName ?? seed?.fullName ?? data.username ?? data.email.split('@')[0],
    role,
    phone: phone ?? seed?.phone,
    address: seed?.address,
    createdAt: seed?.createdAt ?? new Date().toISOString(),
    active: status ? status.toUpperCase() === 'ACTIVE' : (seed?.active ?? true),
  }
}

export function saveAccessToken(token: string) {
  localStorage.setItem('sedsp_access_token', token)
}

export function clearAccessToken() {
  localStorage.removeItem('sedsp_access_token')
}
