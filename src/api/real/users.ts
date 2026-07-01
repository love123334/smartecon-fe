import { http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'
import type { SpringPage } from '@/api/real/products'
import type { User, UserRole } from '@/types'

interface BackendUserSummary {
  id: number
  username: string
  email: string
  fullName: string
  role: string
  status: string
}

const ROLE_MAP: Record<string, UserRole> = {
  CUSTOMER: 'customer',
  SELLER: 'seller',
  MANAGER: 'manager',
  ADMIN: 'admin',
}

const ROLE_TO_BACKEND: Record<Exclude<UserRole, 'guest'>, string> = {
  customer: 'CUSTOMER',
  seller: 'SELLER',
  manager: 'MANAGER',
  admin: 'ADMIN',
}

function mapUser(u: BackendUserSummary): User {
  return {
    id: String(u.id),
    email: u.email,
    fullName: u.fullName,
    role: ROLE_MAP[u.role] ?? 'customer',
    active: u.status === 'ACTIVE',
    phone: '',
    address: '',
    createdAt: new Date().toISOString(),
  }
}

export async function listUsers(page = 0, size = 50): Promise<User[]> {
  const data = await http.get<SpringPage<BackendUserSummary>>(
    `${apiPaths.users.list}?page=${page}&size=${size}`,
  )
  return data.content.map(mapUser)
}

export async function assignRole(userId: string, role: UserRole): Promise<void> {
  if (role === 'guest') throw new Error('Không thể gán role guest')
  await http.put<void>(apiPaths.users.role(userId), {
    role: ROLE_TO_BACKEND[role],
  })
}

export async function setUserActive(userId: string, active: boolean): Promise<void> {
  if (active) {
    await http.patch<void>(apiPaths.users.activate(userId))
  } else {
    await http.patch<void>(apiPaths.users.deactivate(userId))
  }
}
