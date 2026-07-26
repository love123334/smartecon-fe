import type { UserRole } from '@/types'

const STORAGE_KEY = 'sedsp_role_applications_v1'
const OVERRIDE_KEY = 'sedsp_role_overrides_v1'

export type RoleApplicationTarget = 'seller' | 'manager'

export type RoleApplicationStatus = 'pending' | 'approved' | 'rejected'

export interface RoleApplication {
  id: string
  userId: string
  userEmail: string
  userName: string
  targetRole: RoleApplicationTarget
  /** Cá nhân / hộ kinh doanh / công ty */
  applicantType: 'individual' | 'business'
  shopName?: string
  phone: string
  reason: string
  /** Thông tin sơ bộ (CMND/CCCD số, địa chỉ KD, …) */
  documentsNote: string
  /** Tên file đính kèm (demo — không upload server) */
  documentFileName?: string
  status: RoleApplicationStatus
  createdAt: string
  reviewedAt?: string
  reviewedByEmail?: string
  reviewNote?: string
}

function readApps(): RoleApplication[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as RoleApplication[]
  } catch {
    return []
  }
}

function writeApps(list: RoleApplication[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function listRoleApplications(): RoleApplication[] {
  return readApps().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function listPendingRoleApplications(): RoleApplication[] {
  return listRoleApplications().filter((a) => a.status === 'pending')
}

export function getMyRoleApplications(userId: string, email: string): RoleApplication[] {
  const e = email.toLowerCase()
  return listRoleApplications().filter(
    (a) => a.userId === userId || a.userEmail.toLowerCase() === e,
  )
}

export function hasPendingApplication(
  userId: string,
  email: string,
  target?: RoleApplicationTarget,
): boolean {
  return getMyRoleApplications(userId, email).some(
    (a) => a.status === 'pending' && (!target || a.targetRole === target),
  )
}

export function submitRoleApplication(
  input: Omit<RoleApplication, 'id' | 'status' | 'createdAt'>,
): RoleApplication {
  const list = readApps()
  const dup = list.find(
    (a) =>
      a.status === 'pending' &&
      a.targetRole === input.targetRole &&
      (a.userId === input.userId || a.userEmail.toLowerCase() === input.userEmail.toLowerCase()),
  )
  if (dup) {
    throw new Error(`Bạn đã có yêu cầu ${input.targetRole} đang chờ duyệt.`)
  }
  const app: RoleApplication = {
    ...input,
    id: `ra-${Date.now()}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  list.unshift(app)
  writeApps(list)
  return app
}

export function reviewRoleApplication(
  id: string,
  decision: 'approved' | 'rejected',
  reviewerEmail: string,
  note?: string,
): RoleApplication {
  const list = readApps()
  const idx = list.findIndex((a) => a.id === id)
  if (idx < 0) throw new Error('Không tìm thấy yêu cầu')
  const app = list[idx]
  if (app.status !== 'pending') throw new Error('Yêu cầu đã được xử lý')
  list[idx] = {
    ...app,
    status: decision,
    reviewedAt: new Date().toISOString(),
    reviewedByEmail: reviewerEmail,
    reviewNote: note,
  }
  writeApps(list)
  if (decision === 'approved') {
    setRoleOverride(app.userEmail, app.targetRole)
  }
  return list[idx]
}

/** Role override local — dùng khi backend chưa sync / manager duyệt seller */
function readOverrides(): Record<string, UserRole> {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, UserRole>
  } catch {
    return {}
  }
}

export function setRoleOverride(email: string, role: UserRole) {
  const map = readOverrides()
  map[email.trim().toLowerCase()] = role
  localStorage.setItem(OVERRIDE_KEY, JSON.stringify(map))
}

export function getRoleOverride(email: string | undefined): UserRole | null {
  if (!email) return null
  return readOverrides()[email.trim().toLowerCase()] ?? null
}

export function applyRoleOverride<T extends { email: string; role: UserRole }>(user: T): T {
  const override = getRoleOverride(user.email)
  if (!override || override === user.role) return user
  return { ...user, role: override }
}
