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
    fullName: u.fullName || u.username || u.email,
    role: ROLE_MAP[u.role] ?? 'customer',
    active: u.status === 'ACTIVE',
    phone: '',
    address: '',
    createdAt: new Date().toISOString(),
  }
}

function pageContent(data: SpringPage<BackendUserSummary> | null | undefined): BackendUserSummary[] {
  if (!data || !Array.isArray(data.content)) return []
  return data.content
}

export async function listUsers(page = 0, size = 100): Promise<User[]> {
  const first = await http.get<SpringPage<BackendUserSummary>>(
    `${apiPaths.users.list}?page=${page}&size=${size}`,
  )
  const out = pageContent(first).map(mapUser)
  const totalPages = first?.totalPages ?? 1
  for (let p = page + 1; p < totalPages && p < 20; p++) {
    const next = await http.get<SpringPage<BackendUserSummary>>(
      `${apiPaths.users.list}?page=${p}&size=${size}`,
    )
    out.push(...pageContent(next).map(mapUser))
  }
  return out
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

export async function deleteUser(userId: string): Promise<void> {
  await http.delete<void>(apiPaths.users.delete(userId))
}
