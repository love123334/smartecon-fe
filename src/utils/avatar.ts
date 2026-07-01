import type { User } from '@/types'

export interface AvatarPreset {
  id: string
  emoji: string
  label: string
  bg: string
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'default', emoji: '🙂', label: 'Mặc định', bg: '#e0f2fe' },
  { id: 'spark', emoji: '✨', label: 'Sáng tạo', bg: '#fef3c7' },
  { id: 'tech', emoji: '💻', label: 'Tech', bg: '#ede9fe' },
  { id: 'shop', emoji: '🛍️', label: 'Mua sắm', bg: '#fce7f3' },
  { id: 'star', emoji: '⭐', label: 'VIP', bg: '#fef9c3' },
  { id: 'leaf', emoji: '🌿', label: 'Xanh', bg: '#dcfce7' },
  { id: 'fire', emoji: '🔥', label: 'Hot', bg: '#fee2e2' },
  { id: 'rocket', emoji: '🚀', label: 'Nhanh', bg: '#e0e7ff' },
]

const STORAGE_PREFIX = 'sedsp_avatar_'
const MAX_UPLOAD_BYTES = 280_000

export interface UserAvatarData {
  avatarPreset?: string
  avatarUrl?: string
}

export function avatarStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

export function getUserAvatar(userId: string): UserAvatarData {
  try {
    const raw = localStorage.getItem(avatarStorageKey(userId))
    if (!raw) return {}
    return JSON.parse(raw) as UserAvatarData
  } catch {
    return {}
  }
}

export function saveUserAvatar(userId: string, data: UserAvatarData): void {
  localStorage.setItem(avatarStorageKey(userId), JSON.stringify(data))
}

export function applyAvatarToUser(user: User): User {
  const saved = getUserAvatar(user.id)
  return {
    ...user,
    avatarPreset: saved.avatarPreset ?? user.avatarPreset ?? 'default',
    avatarUrl: saved.avatarUrl ?? user.avatarUrl,
  }
}

export function getPresetById(id?: string): AvatarPreset {
  return AVATAR_PRESETS.find((p) => p.id === id) ?? AVATAR_PRESETS[0]
}

export function readAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Chỉ chấp nhận file ảnh'))
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      reject(new Error('Ảnh tối đa ~270KB. Hãy chọn ảnh nhỏ hơn.'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Không đọc được file ảnh'))
    reader.readAsDataURL(file)
  })
}
