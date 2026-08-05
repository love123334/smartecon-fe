import { normalizeText, wordSimilarity } from '@/api/chat/match'
import { expandQueryTerms, matchCategoryFromText } from '@/api/chat/synonyms'
import type { Product } from '@/types'

const STOP_WORDS = new Set([
  'cho', 'toi', 'minh', 'ban', 'la', 'gi', 'co', 'khong', 'nhu', 'the', 'nao', 've',
  'san', 'pham', 'mua', 'can', 'muon', 'hoi', 'giai', 'thich', 'tu', 'van', 'vay',
  'what', 'does', 'this', 'website', 'web', 'shop', 'store', 'sell', 'you', 'do',
  'how', 'much', 'is', 'the', 'a', 'an', 'my', 'me', 'please', 'thanks', 'hay',
  'voi', 'cua', 'mot', 'cac', 'nhung', 'that', 'qua', 'roi', 'nhe', 'nha', 'ah',
  'uhm', 'ok', 'oke', 'duoc', 'ko', 'k', 'j', 'bao', 'nhieu', 'gia', 'con',
  'tim', 'kiem', 'search', 'find', 'sp', 'hang', 'loai', 'mau', 'xem', 'goi',
  'y', 'suggest', 'recommend', 'nen', 'trong', 'tam', 'khoang', 'duoi', 'tren',
  'tu', 'den', 'toi', 'da', 'max', 'min', 'budget', 'ngan', 'sach', 'under',
  'around', 'about', 'gan', 'tam', 'gia',
  // tránh search lẫn khi hỏi đơn / tài khoản
  'don', 'order', 'orders', 'status', 'trang', 'thai', 'lich', 'su', 'theo', 'doi',
])

export interface PriceRange {
  min: number | null
  max: number | null
}

function parseMoneyToken(numRaw: string, unitRaw?: string): number | null {
  const num = Number(String(numRaw).replace(',', '.'))
  if (!Number.isFinite(num) || num < 0) return null
  const unit = normalizeText(unitRaw ?? '')
  if (unit.startsWith('tr') || unit === 'm' || unit === 'trieu') return Math.round(num * 1_000_000)
  if (unit === 'k' || unit.startsWith('ngh')) return Math.round(num * 1_000)
  // số trần không đơn vị nhỏ → triệu trong ngữ cảnh giá VN
  if (!unit && num > 0 && num < 1000) return Math.round(num * 1_000_000)
  return Math.round(num)
}

/** Trích khoảng giá: dưới X · từ X đến Y · X-Y triệu · trên X */
export function extractPriceRange(raw: string): PriceRange | null {
  const n = normalizeText(raw)

  const between =
    n.match(
      /(?:tu|from|khoang|around)?\s*(\d+[.,]?\d*)\s*(trieu|tr|m|k|nghin|ngan)?\s*(?:-|–|den|to|toi)\s*(\d+[.,]?\d*)\s*(trieu|tr|m|k|nghin|ngan)?/,
    ) ??
    n.match(
      /(\d+[.,]?\d*)\s*(trieu|tr|m|k)?\s*(?:-|–)\s*(\d+[.,]?\d*)\s*(trieu|tr|m|k)?/,
    )
  if (between) {
    const leftUnit = between[2] || between[4]
    const rightUnit = between[4] || between[2]
    const min = parseMoneyToken(between[1], leftUnit ?? undefined)
    const max = parseMoneyToken(between[3], rightUnit ?? undefined)
    if (min != null && max != null) {
      return { min: Math.min(min, max), max: Math.max(min, max) }
    }
  }

  const under =
    n.match(/(?:duoi|under|toi da|max|<=|<|khong qua|re hon)\s*(\d+[.,]?\d*)\s*(trieu|tr|m|k|nghin|ngan)?/) ??
    n.match(/(\d+[.,]?\d*)\s*(trieu|tr)\s*(?:tro xuong|do xuong|thoi|tro lai)?/) ??
    n.match(/(?:trong tam|tam gia|ngan sach|budget)\s*(?:khoang|around|about)?\s*(\d+[.,]?\d*)\s*(trieu|tr|m|k)?/) ??
    n.match(/budget\s*(\d+[.,]?\d*)\s*(trieu|tr|k)?/)
  if (under) {
    const max = parseMoneyToken(under[1], under[2])
    if (max != null && max > 0) return { min: null, max }
  }

  const over = n.match(/(?:tren|from|tu|>=|>|it nhat|toi thieu)\s*(\d+[.,]?\d*)\s*(trieu|tr|m|k|nghin|ngan)?/)
  if (over && /tren|>=|>|it nhat|toi thieu|tu\s+\d/.test(n) && !/tu\s+\d+.+(den|to|toi|-)/.test(n)) {
    const min = parseMoneyToken(over[1], over[2])
    if (min != null && min > 0) return { min, max: null }
  }

  return null
}

/** @deprecated dùng extractPriceRange — giữ tương thích */
export function extractBudgetVnd(raw: string): number | null {
  const range = extractPriceRange(raw)
  return range?.max ?? null
}

/** Bỏ token giá khỏi câu để search text sạch hơn */
export function stripPriceTokens(raw: string): string {
  return normalizeText(raw)
    .replace(
      /(?:tu|from|khoang|duoi|under|toi da|max|tren|toi thieu|it nhat|budget|ngan sach|trong tam|tam gia)?\s*\d+[.,]?\d*\s*(trieu|tr|m|k|nghin|ngan)?(?:\s*(?:-|–|den|to|toi)\s*\d+[.,]?\d*\s*(trieu|tr|m|k|nghin|ngan)?)?/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()
}

export function applyPriceRange(products: Product[], range: PriceRange | null): Product[] {
  if (!range) return products
  return products.filter((p) => {
    if (range.min != null && p.price < range.min) return false
    if (range.max != null && p.price > range.max) return false
    return true
  })
}

export function findProductsByQuery(products: Product[], query: string): Product[] {
  const expanded = expandQueryTerms(query)
  const words = expanded.filter((w) => {
    const parts = w.split(/\s+/)
    if (parts.length > 1) return true
    return w.length > 2 && !STOP_WORDS.has(w)
  })
  if (!words.length) return []

  const scored = products
    .map((p) => {
      const hay = normalizeText(
        `${p.name} ${p.category} ${p.description} ${p.shopName ?? ''} ${p.sellerEmail ?? ''}`,
      )
      let score = 0
      for (const w of words) {
        if (hay.includes(w)) {
          score += w.length * (w.includes(' ') ? 3.2 : 2.2)
          continue
        }
        for (const hw of hay.split(/\s+/)) {
          const sim = wordSimilarity(hw, w)
          if (sim >= 0.74) score += w.length * sim
        }
      }
      score += Math.min(p.soldCount / 500, 1.5)
      return { p, score }
    })
    .filter((x) => x.score >= 4)
    .sort((a, b) => b.score - a.score)

  return scored.map((x) => x.p)
}

export function pickProductCatalog(
  products: Product[],
  sellerProducts: Product[],
  role: string,
): Product[] {
  return role === 'seller' && sellerProducts.length ? sellerProducts : products
}

export function cheapestProducts(products: Product[], limit = 5): Product[] {
  if (!products.length) return []
  const sorted = [...products].sort((a, b) => a.price - b.price)
  const minPrice = sorted[0].price
  // Chỉ các SP đúng mức giá thấp nhất — không trộn SP đắt hơn
  const atFloor = sorted.filter((p) => p.price === minPrice)
  return atFloor.slice(0, Math.min(limit, 4))
}

export function productsUnderBudget(products: Product[], budget: number, limit = 6): Product[] {
  return applyPriceRange(products, { min: null, max: budget })
    .filter((p) => p.stock > 0)
    .sort((a, b) => a.price - b.price)
    .slice(0, limit)
}

export interface SmartProductFilterResult {
  products: Product[]
  range: PriceRange | null
  categoryName: string | null
  queryText: string
}

/**
 * Lọc SP thông minh: khoảng giá + danh mục + từ khóa (vd: "tai nghe dưới 2 triệu").
 */
export function filterProductsForQuery(
  products: Product[],
  raw: string,
  categories: { name: string; slug: string }[] = [],
  limit = 8,
): SmartProductFilterResult {
  const range = extractPriceRange(raw)
  const matchedCat = matchCategoryFromText(raw, categories)
  const queryText = stripPriceTokens(raw)

  let pool = products.filter((p) => (p.stock ?? 0) > 0)

  if (matchedCat) {
    const catNorm = normalizeText(matchedCat.name)
    const byCat = pool.filter((p) => normalizeText(p.category) === catNorm)
    if (byCat.length) pool = byCat
  }

  pool = applyPriceRange(pool, range)

  let hits: Product[] = []
  if (queryText.length >= 2) {
    hits = findProductsByQuery(pool, queryText)
    // nếu text search quá hẹp sau khi đã lọc giá/danh mục → nới: lấy pool theo giá
    if (!hits.length && (range || matchedCat)) {
      hits = [...pool].sort((a, b) => a.price - b.price)
    }
  } else if (range || matchedCat) {
    hits = [...pool].sort((a, b) => a.price - b.price)
  }

  return {
    products: hits.slice(0, limit),
    range,
    categoryName: matchedCat?.name ?? null,
    queryText,
  }
}

export function formatPriceRangeLabel(range: PriceRange): string {
  if (range.min != null && range.max != null) {
    return `${formatCompactVnd(range.min)} – ${formatCompactVnd(range.max)}`
  }
  if (range.max != null) return `≤ ${formatCompactVnd(range.max)}`
  if (range.min != null) return `≥ ${formatCompactVnd(range.min)}`
  return ''
}

/** Gộp SP theo shop — dùng khi hỏi "chỗ nào bán…" */
export function groupProductsByShop(
  products: Product[],
  limitShops = 5,
  perShop = 3,
): { shop: string; products: Product[]; sellerEmail?: string; sellerPhone?: string }[] {
  const map = new Map<string, Product[]>()
  for (const p of products) {
    const shop = (p.shopName || 'SEDSP Official').trim()
    const list = map.get(shop) ?? []
    list.push(p)
    map.set(shop, list)
  }
  return [...map.entries()]
    .map(([shop, list]) => {
      const ranked = [...list].sort(
        (a, b) => b.rating - a.rating || b.soldCount - a.soldCount || a.price - b.price,
      )
      const top = ranked[0]
      return {
        shop,
        products: ranked.slice(0, perShop),
        sellerEmail: top?.sellerEmail,
        sellerPhone: top?.sellerPhone,
      }
    })
    .sort((a, b) => {
      const score = (g: (typeof a)) =>
        g.products.reduce((s, p) => s + p.rating * 10 + Math.min(p.soldCount, 200), 0)
      return score(b) - score(a)
    })
    .slice(0, limitShops)
}

/** Xếp SP “ngon / đáng mua”: rating + đã bán + còn hàng */
export function rankRecommendedProducts(products: Product[], limit = 6): Product[] {
  return [...products]
    .filter((p) => (p.stock ?? 0) > 0)
    .sort((a, b) => {
      const score = (p: Product) => p.rating * 12 + Math.min(p.soldCount, 300) / 20 - p.price / 50_000_000
      return score(b) - score(a)
    })
    .slice(0, limit)
}

function formatCompactVnd(amount: number): string {
  if (amount >= 1_000_000 && amount % 1_000_000 === 0) {
    return `${amount / 1_000_000} triệu`
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1).replace(/\.0$/, '')} triệu`
  }
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ'
}
