import { normalizeText, wordSimilarity } from '@/api/chat/match'
import { expandQueryTerms } from '@/api/chat/synonyms'
import type { Product } from '@/types'

const STOP_WORDS = new Set([
  'cho', 'toi', 'minh', 'ban', 'la', 'gi', 'co', 'khong', 'nhu', 'the', 'nao', 've',
  'san', 'pham', 'mua', 'can', 'muon', 'hoi', 'giai', 'thich', 'tu', 'van', 'vay',
  'what', 'does', 'this', 'website', 'web', 'shop', 'store', 'sell', 'you', 'do',
  'how', 'much', 'is', 'the', 'a', 'an', 'my', 'me', 'please', 'thanks', 'hay',
  'voi', 'cua', 'mot', 'cac', 'nhung', 'that', 'qua', 'roi', 'nhe', 'nha', 'ah',
  'uhm', 'ok', 'oke', 'duoc', 'ko', 'k', 'j', 'bao', 'nhieu', 'gia', 'con',
])

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
      // ưu tiên SP bán chạy khi điểm ngang nhau
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
  return [...products].filter((p) => p.stock > 0).sort((a, b) => a.price - b.price).slice(0, limit)
}

export function productsUnderBudget(products: Product[], budget: number, limit = 6): Product[] {
  return [...products]
    .filter((p) => p.price <= budget && p.stock > 0)
    .sort((a, b) => a.price - b.price)
    .slice(0, limit)
}

/** Trích ngân sách từ câu hỏi (vd: dưới 2 triệu, dưới 500k) */
export function extractBudgetVnd(raw: string): number | null {
  const n = normalizeText(raw)
  const m =
    n.match(/(?:duoi|under|toi da|max|<=|<)\s*(\d+[.,]?\d*)\s*(trieu|tr|m|k|nghin|ngan)?/) ??
    n.match(/(\d+[.,]?\d*)\s*(trieu|tr)\s*(?:tro xuong|do xuong|thoi)?/) ??
    n.match(/budget\s*(\d+[.,]?\d*)\s*(trieu|tr|k)?/)
  if (!m) return null
  const num = Number(String(m[1]).replace(',', '.'))
  if (Number.isNaN(num)) return null
  const unit = m[2] ?? ''
  if (unit.startsWith('tr') || unit === 'm') return Math.round(num * 1_000_000)
  if (unit === 'k' || unit.startsWith('ngh')) return Math.round(num * 1_000)
  // số trần không đơn vị: nếu < 1000 coi là triệu khi ngữ cảnh "duoi X"
  if (num < 1000 && /duoi|under|trieu|budget/.test(n)) return Math.round(num * 1_000_000)
  return Math.round(num)
}
