const PREFIX = 'sedsp_'

export function storageGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function storageSet<T>(key: string, value: T): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value))
}

export function storageRemove(key: string): void {
  localStorage.removeItem(PREFIX + key)
}

export const STORAGE_KEYS = {
  initialized: 'initialized',
  users: 'users',
  products: 'products',
  orders: 'orders',
  carts: 'carts',
  session: 'session',
  chatHistory: 'chat_history',
} as const
