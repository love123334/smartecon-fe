import type { User } from '@/types'

const SNAPSHOT_KEY = 'sedsp_user_snapshot'

export function saveUserSnapshot(user: User): void {
  try {
    localStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({
        id: user.id,
        backendId: user.backendId,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        phone: user.phone,
        address: user.address,
        avatarPreset: user.avatarPreset,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        active: user.active,
      }),
    )
  } catch {
    /* ignore */
  }
}

export function readUserSnapshot(): User | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<User>
    if (!data?.id || !data?.email || !data?.role) return null
    return {
      id: String(data.id),
      backendId: data.backendId ? String(data.backendId) : undefined,
      email: String(data.email),
      fullName: String(data.fullName ?? data.email.split('@')[0]),
      role: data.role as User['role'],
      phone: data.phone,
      address: data.address,
      avatarPreset: data.avatarPreset,
      avatarUrl: data.avatarUrl,
      createdAt: data.createdAt ?? new Date().toISOString(),
      active: data.active ?? true,
    }
  } catch {
    return null
  }
}

export function clearUserSnapshot(): void {
  try {
    localStorage.removeItem(SNAPSHOT_KEY)
  } catch {
    /* ignore */
  }
}
