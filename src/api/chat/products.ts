import { normalizeText, wordSimilarity } from '@/api/chat/match'
import type { Product } from '@/types'

const STOP_WORDS = new Set([
  'cho', 'toi', 'minh', 'ban', 'la', 'gi', 'co', 'khong', 'nhu', 'the', 'nao', 've',
  'san', 'pham', 'mua', 'can', 'muon', 'hoi', 'giai', 'thich', 'tu', 'van', 'vay',
  'what', 'does', 'this', 'website', 'web', 'shop', 'store', 'sell', 'you', 'do',
  'how', 'much', 'is', 'the', 'a', 'an', 'my', 'me', 'please', 'thanks',
])

export function findProductsByQuery(products: Product[], query: string): Product[] {
  const q = normalizeText(query)
  const words = q.split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  if (!words.length) return []

  const scored = products
    .map((p) => {
      const hay = normalizeText(`${p.name} ${p.category} ${p.description} ${p.shopName ?? ''}`)
      let score = 0
      for (const w of words) {
        if (hay.includes(w)) {
          score += w.length * 2
          continue
        }
        for (const hw of hay.split(/\s+/)) {
          if (wordSimilarity(hw, w) >= 0.72) score += w.length
        }
      }
      return { p, score }
    })
    .filter((x) => x.score > 0)
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
