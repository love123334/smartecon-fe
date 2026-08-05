const HISTORY_KEY = 'sedsp_search_history'
const MAX_HISTORY = 8

/** Từ khóa xu hướng mặc định (kết hợp thêm danh mục live khi có). */
export const DEFAULT_SEARCH_TRENDS = [
  'Điện thoại',
  'Laptop',
  'Tai nghe',
  'Thời trang nữ',
  'Giày dép',
  'Gia dụng',
  'Đồ thể thao',
  'Sách',
]

export function getSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((x) => x.trim())
      .slice(0, MAX_HISTORY)
  } catch {
    return []
  }
}

export function addSearchHistory(query: string): string[] {
  const q = query.trim()
  if (!q) return getSearchHistory()
  const next = [q, ...getSearchHistory().filter((h) => h.toLowerCase() !== q.toLowerCase())].slice(
    0,
    MAX_HISTORY,
  )
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch {
    /* quota / private mode */
  }
  return next
}

export function removeSearchHistory(query: string): string[] {
  const next = getSearchHistory().filter((h) => h.toLowerCase() !== query.trim().toLowerCase())
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

export function clearSearchHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch {
    /* ignore */
  }
}

/** Xu hướng = danh mục live (ưu tiên) + mặc định, unique. */
export function buildSearchTrends(categories: string[] = []): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of [...categories, ...DEFAULT_SEARCH_TRENDS]) {
    const key = item.trim()
    if (!key) continue
    const norm = key.toLowerCase()
    if (seen.has(norm)) continue
    seen.add(norm)
    out.push(key)
    if (out.length >= 10) break
  }
  return out
}
