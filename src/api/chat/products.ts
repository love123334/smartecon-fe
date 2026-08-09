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
  'around', 'about', 'gan', 'tam', 'gia', 'ca',
  'trung', 'binh', 'average', 'avg', 'tb', 'khoang',
  // tránh search lẫn khi hỏi đơn / tài khoản
  'don', 'order', 'orders', 'status', 'trang', 'thai', 'lich', 'su', 'theo', 'doi',
])

/** Cụm SP ưu tiên khi tạo nhãn / lọc giá TB */
const FOCUS_PHRASES = [
  'tai nghe',
  'ban phim',
  'macbook',
  'iphone',
  'airpods',
  'airpod',
  'dien thoai',
  'laptop',
  'chuot',
  'may tinh bang',
  'ipad',
  'noi chien',
  'giay',
  'serum',
  'kinh',
  'mat kinh',
] as const

export interface PriceRange {
  min: number | null
  max: number | null
}

export interface ProductPriceStats {
  label: string
  count: number
  average: number
  min: number
  max: number
  cheapest: Product
  priciest: Product
  products: Product[]
}

/** Hỏi giá trung bình / khoảng giá / thống kê giá theo brand-SP */
export function isPriceStatsQuery(raw: string): boolean {
  const n = normalizeText(raw)
  return (
    /trung binh|gia tb|tb gia|average|avg price|gia trung|khoang gia|gia thap nhat .* cao nhat|min max gia|gia min|gia max/.test(
      n,
    ) || /gia\s+\w+.+(trung binh|tb|average)/.test(n) || /(trung binh|average|tb).+gia/.test(n)
  )
}

export function computeProductPriceStats(
  products: Product[],
  label: string,
  limit = 4,
): ProductPriceStats | null {
  const pool = products.filter((p) => Number.isFinite(p.price) && p.price > 0)
  if (!pool.length) return null
  const sorted = [...pool].sort((a, b) => a.price - b.price)
  const sum = sorted.reduce((s, p) => s + p.price, 0)
  return {
    label: label || 'nhóm sản phẩm',
    count: sorted.length,
    average: sum / sorted.length,
    min: sorted[0].price,
    max: sorted[sorted.length - 1].price,
    cheapest: sorted[0],
    priciest: sorted[sorted.length - 1],
    products: sorted.slice(0, limit),
  }
}

function titleCaseWords(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Nhãn brand/SP từ câu hỏi (vd: macbook, iphone, tai nghe) */
export function extractProductFocusLabel(raw: string): string {
  const full = normalizeText(raw)
  // Ưu tiên cụm SP đã biết — tránh "Tai Nghe Ca" từ "giá cả"
  for (const phrase of FOCUS_PHRASES) {
    if (full.includes(phrase)) return titleCaseWords(phrase)
  }

  const n = full
    .replace(/\bgia\s*ca\b/g, ' ')
    .replace(
      /\b(gia|bao nhieu|trung binh|average|avg|tb|khoang|thap nhat|cao nhat|min|max|cua|cac|sp|san pham|hang|ca)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()
  if (!n) return 'sản phẩm'
  return titleCaseWords(n)
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
      /(?:tu|from|khoang|duoi|under|toi da|max|tren|toi thieu|it nhat|budget|ngan sach|trong tam|tam gia|trung binh|average|avg|tb)?\s*\d+[.,]?\d*\s*(trieu|tr|m|k|nghin|ngan)?(?:\s*(?:-|–|den|to|toi)\s*\d+[.,]?\d*\s*(trieu|tr|m|k|nghin|ngan)?)?/g,
      ' ',
    )
    .replace(/\b(gia\s*ca|trung binh|average|avg|gia tb|tb gia|khoang gia|bao nhieu)\b/g, ' ')
    .replace(/\b(gia|ca)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const AFFORDABLE_PHRASES =
  /\b(gia re|re nhat|re hon|tiet kiem|gia tot|gia mem|muc re|cheap|affordable)\b/

/** Bỏ cụm "giá rẻ / rẻ" khỏi câu để lấy tên SP (vd: "kính giá rẻ" → "kính") */
export function stripAffordableMarkers(raw: string): string {
  return normalizeText(raw)
    .replace(AFFORDABLE_PHRASES, ' ')
    .replace(/\b(re)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractAffordableSearchTerms(raw: string): string[] {
  const q = stripAffordableMarkers(stripPriceTokens(raw))
  return q.split(/\s+/).filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
}

/** "kính rẻ", "tai nghe giá rẻ" — không có số tiền cụ thể */
export function isAffordableProductQuery(raw: string): boolean {
  const n = normalizeText(raw)
  if (extractPriceRange(raw)) return false
  const hasAffordableCue =
    AFFORDABLE_PHRASES.test(n) ||
    /\b\w{3,}\s+re\b/.test(n) ||
    /\bre\s+\w{3,}\b/.test(n)
  if (!hasAffordableCue) return false
  return extractAffordableSearchTerms(raw).length > 0
}

export function affordableProductsForQuery(
  products: Product[],
  raw: string,
  limit = 6,
): Product[] {
  const query = extractAffordableSearchTerms(raw).join(' ')
  if (!query) return []
  return [...findProductsByQuery(products, query)]
    .sort((a, b) => a.price - b.price)
    .slice(0, limit)
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
  const normalizedQuery = normalizeText(query)
  const originalWords = normalizedQuery
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  const focusPhrase = FOCUS_PHRASES.find((phrase) => normalizedQuery.includes(phrase)) ?? null
  const expanded = expandQueryTerms(query)
  const words = expanded.filter((w) => {
    const parts = w.split(/\s+/)
    if (parts.length > 1) return true
    return w.length > 2 && !STOP_WORDS.has(w)
  })
  if (!words.length && !focusPhrase) return []

  const scored = products
    .map((p) => {
      const nameHay = normalizeText(p.name)
      const hay = normalizeText(
        `${p.name} ${p.category} ${p.description} ${p.shopName ?? ''} ${p.sellerEmail ?? ''}`,
      )
      let score = 0
      let nameHit = false
      let phraseHit = false

      if (focusPhrase) {
        if (nameHay.includes(focusPhrase)) {
          score += focusPhrase.length * 10
          nameHit = true
          phraseHit = true
        } else if (hay.includes(focusPhrase)) {
          score += focusPhrase.length * 4
          phraseHit = true
        }
      }

      // Ưu tiên khớp đúng từ trong câu hỏi trên TÊN SP (macbook ≠ mọi laptop)
      for (const w of originalWords) {
        if (nameHay.includes(w)) {
          score += w.length * 6
          nameHit = true
        }
      }
      for (const w of words) {
        if (hay.includes(w)) {
          // Match chỉ ở category/mô tả (vd: laptop) nhẹ hơn match tên
          const inName = nameHay.includes(w)
          score += w.length * (inName ? (w.includes(' ') ? 3.2 : 2.4) : w.includes(' ') ? 1.2 : 0.85)
          continue
        }
        // Fuzzy chỉ trên từ đơn ≥4 — tránh nhiễu synonym
        if (w.includes(' ') || w.length < 4) continue
        for (const hw of hay.split(/\s+/)) {
          if (hw.length < 4) continue
          const sim = wordSimilarity(hw, w)
          if (sim >= 0.82) score += w.length * sim * (nameHay.includes(hw) ? 1 : 0.45)
        }
      }
      score += Math.min(p.soldCount / 500, 1.5)
      // Có brand/cụm rõ trong câu hỏi mà tên SP không chứa → loại mạnh
      if (originalWords.length && !nameHit && originalWords.some((w) => w.length >= 4)) {
        score *= 0.25
      }
      // Hỏi cụm SP rõ (tai nghe…) mà không đụng cụm đó → loại
      if (focusPhrase && !phraseHit && !nameHit) {
        score *= 0.15
      }
      return { p, score, nameHit, phraseHit }
    })
    .filter((x) => x.score >= 4)
    .sort((a, b) => b.score - a.score || Number(b.nameHit) - Number(a.nameHit))

  // Có cụm focus → chỉ giữ SP khớp cụm/tên; không fallback serum/bếp
  if (focusPhrase) {
    const focused = scored.filter((x) => x.phraseHit || x.nameHit)
    if (focused.length) return focused.map((x) => x.p)
    return []
  }

  // Nếu có hit đúng tên brand → chỉ giữ nhóm đó (tránh Dell lẫn MacBook)
  const withName = scored.filter((x) => x.nameHit)
  const picked = withName.length ? withName : scored
  return picked.map((x) => x.p)
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
 * Brand rõ (macbook…) → ưu tiên text search, không fallback cả danh mục Laptop.
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
  const brandish = /macbook|iphone|airpod|samsung|dell|hp|asus|lenovo|xiaomi|sony|logitech/.test(
    normalizeText(raw),
  )

  let pool = products.filter((p) => (p.stock ?? 0) > 0)

  // Brand rõ: search trên toàn catalog trước, đừng ép cả category
  if (!brandish && matchedCat) {
    const catNorm = normalizeText(matchedCat.name)
    const byCat = pool.filter((p) => normalizeText(p.category) === catNorm)
    if (byCat.length) pool = byCat
  }

  pool = applyPriceRange(pool, range)

  // Ưu tiên lọc theo tên shop/seller ("sản phẩm của Trần Thị Bán")
  const sellerQ = extractSellerNameQuery(raw)
  if (sellerQ) {
    const bySeller = findProductsBySellerName(pool, sellerQ)
    return {
      products: bySeller.slice(0, limit),
      range,
      categoryName: null,
      queryText: sellerQ,
    }
  }

  let hits: Product[] = []
  if (queryText.length >= 2) {
    hits = findProductsByQuery(pool, queryText)
    // không fallback cả category khi user hỏi brand cụ thể
    if (!hits.length && (range || matchedCat) && !brandish) {
      hits = [...pool].sort((a, b) => a.price - b.price)
    }
  } else if (range || matchedCat) {
    hits = [...pool].sort((a, b) => a.price - b.price)
  }

  return {
    products: hits.slice(0, limit),
    range,
    categoryName: brandish ? null : matchedCat?.name ?? null,
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

/**
 * "Cho tôi xem sản phẩm của Trần Thị Bán" → "tran thi ban"
 * Giữ nguyên "ban" trong tên (không dùng STOP_WORDS).
 */
export function extractSellerNameQuery(raw: string): string | null {
  const n = normalizeText(raw)
  const patterns = [
    /(?:cho\s+(?:toi|minh)\s+)?(?:xem|tim|liet ke|show)?\s*(?:san pham|sp|hang)\s+cua\s+(?:shop\s+)?(.+)/,
    /(?:san pham|sp|hang)\s+(?:tu|o)\s+(?:shop\s+)?(.+)/,
    /cua\s+shop\s+(.+)/,
    /shop\s+(.+?)\s+(?:ban gi|co gi|co nhung|dang ban)/,
  ]
  for (const re of patterns) {
    const m = n.match(re)
    if (!m?.[1]) continue
    const name = m[1]
      .replace(
        /\b(xem|cho|toi|minh|voi|nhe|nha|di|da|ah|a|please|giup|ho|duoc|khong|ko|nhe|em|anh|chi)\b/g,
        ' ',
      )
      .replace(/\s+/g, ' ')
      .trim()
    // Tên seller/shop tối thiểu 2 token hoặc 1 token ≥4 (tránh "cua ban" = you)
    const words = name.split(/\s+/).filter(Boolean)
    if (words.length >= 2) return name
    if (words.length === 1 && words[0].length >= 4 && words[0] !== 'ban') return name
  }
  return null
}

export function findProductsBySellerName(products: Product[], sellerQuery: string): Product[] {
  const q = normalizeText(sellerQuery)
  const qWords = q.split(/\s+/).filter((w) => w.length >= 2)
  if (!qWords.length) return []

  return products
    .map((p) => {
      const shop = normalizeText(p.shopName ?? '')
      const email = normalizeText(p.sellerEmail ?? '')
      if (!shop && !email) return { p, score: 0 }

      let score = 0
      if (shop === q) score += 80
      else if (shop.includes(q) || (q.includes(shop) && shop.length >= 5)) score += 55

      const shopWords = shop.split(/\s+/).filter(Boolean)
      let hit = 0
      for (const w of qWords) {
        if (shopWords.some((sw) => sw === w || (w.length >= 3 && (sw.includes(w) || w.includes(sw))))) {
          score += w.length * 6
          hit++
        } else if (email.includes(w)) {
          score += w.length * 2
          hit++
        }
      }
      // Multi-word seller names: need most tokens (keeps "tran thi ban")
      if (qWords.length >= 2 && hit < Math.ceil(qWords.length * 0.6)) score = 0
      return { p, score }
    })
    .filter((x) => x.score >= 12)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p)
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
