import { containsWholePhrase, fieldContainsToken, normalizeText, wordSimilarity } from '@/api/chat/match'
import { isShopCatalogQuestion, stripTrailingFillers } from '@/api/chat/chatLocale'
import { expandQueryTerms } from '@/api/chat/synonyms'
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

/** Brand/cụm rõ — chỉ siết lọc khi user hỏi đúng tên hãng/model */
/** Gợi ý danh mục khi user hỏi SP thuộc nhóm rõ (áo → thời trang, không lẫn điện thoại). */
interface SearchCategoryIntent {
  triggers: string[]
  allowedCategories: string[]
  blockedCategories: string[]
}

const SEARCH_CATEGORY_INTENTS: SearchCategoryIntent[] = [
  {
    triggers: [
      'ao', 'ao thun', 'ao nam', 'ao nu', 'shirt', 'tshirt', 'tee', 'polo', 'hoodie',
      'quan', 'quan jean', 'vay', 'dam', 'crop top', 'thoi trang', 'fashion',
    ],
    allowedCategories: ['thoi trang', 'the thao', 'giay dep'],
    blockedCategories: ['dien thoai', 'dien tu', 'laptop', 'may tinh', 'tablet', 'nha bep', 'am thuc', 'sach'],
  },
  {
    triggers: ['dien thoai', 'smartphone', 'iphone', 'mobile phone'],
    allowedCategories: ['dien thoai', 'phu kien'],
    blockedCategories: ['thoi trang', 'nha bep', 'sach', 'noi that'],
  },
  {
    triggers: ['laptop', 'macbook', 'may tinh xach tay', 'notebook'],
    allowedCategories: ['laptop', 'may tinh', 'dien tu'],
    blockedCategories: ['thoi trang', 'nha bep', 'am thuc'],
  },
  {
    triggers: ['tai nghe', 'headphone', 'earbuds', 'headset'],
    allowedCategories: ['dien tu', 'phu kien', 'am thanh'],
    blockedCategories: ['thoi trang', 'nha bep', 'sach'],
  },
  {
    triggers: ['may tinh bang', 'tablet', 'ipad'],
    allowedCategories: ['may tinh bang', 'tablet', 'dien tu', 'phu kien'],
    blockedCategories: ['do da ngoai', 'outdoor', 'camping', 'nha bep', 'thoi trang', 'cham soc da'],
  },
  {
    triggers: ['gia dung', 'do gia dung', 'nha cua'],
    allowedCategories: ['gia dung', 'nha cua', 'nha bep', 'noi that', 'trang tri', 'kitchen'],
    blockedCategories: ['dien thoai', 'laptop', 'thoi trang', 'cham soc da', 'makeup'],
  },
  {
    triggers: ['giay', 'sneaker', 'giay dep'],
    allowedCategories: ['giay dep', 'the thao', 'thoi trang'],
    blockedCategories: ['dien thoai', 'laptop', 'nha bep'],
  },
]

function detectSearchCategoryIntent(
  normalizedQuery: string,
  originalWords: string[],
  searchPhrases: string[],
): SearchCategoryIntent | null {
  for (const intent of SEARCH_CATEGORY_INTENTS) {
    for (const trigger of intent.triggers) {
      if (
        containsWholePhrase(normalizedQuery, trigger) ||
        originalWords.some((w) => w === trigger || (trigger.includes(' ') && w === trigger.split(' ')[0]))
      ) {
        return intent
      }
    }
    for (const phrase of searchPhrases) {
      if (intent.triggers.some((t) => phrase === t || phrase.includes(t))) return intent
    }
  }
  return null
}

function categoryMatchesIntent(catHay: string, intent: SearchCategoryIntent): boolean {
  return intent.allowedCategories.some((a) => catHay.includes(a))
}

function categoryBlockedByIntent(catHay: string, intent: SearchCategoryIntent): boolean {
  return intent.blockedCategories.some((b) => catHay.includes(b))
}

const STRICT_BRAND_TERMS = new Set([
  'macbook',
  'iphone',
  'airpod',
  'airpods',
  'samsung',
  'dell',
  'hp',
  'asus',
  'lenovo',
  'xiaomi',
  'sony',
  'logitech',
  'airflex',
  'keypro',
])

function deriveSearchPhrases(normalizedQuery: string, originalWords: string[]): string[] {
  const phrases = new Set<string>()
  for (const phrase of [...FOCUS_PHRASES].sort((a, b) => b.length - a.length)) {
    if (normalizedQuery.includes(phrase)) phrases.add(phrase)
  }
  for (let i = 0; i < originalWords.length - 1; i++) {
    phrases.add(`${originalWords[i]} ${originalWords[i + 1]}`)
  }
  if (originalWords.length >= 3) {
    phrases.add(originalWords.slice(0, 3).join(' '))
  }
  if (originalWords.length >= 2) {
    phrases.add(originalWords.join(' '))
  }
  if (originalWords.length === 1 && originalWords[0].length >= 3) {
    phrases.add(originalWords[0])
  }
  return [...phrases].sort((a, b) => b.length - a.length)
}

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
  if (unit.startsWith('tr') || unit === 'm' || unit === 'trieu' || unit === 'cu' || unit === 'cuu')
    return Math.round(num * 1_000_000)
  if (unit === 'k' || unit.startsWith('ngh')) return Math.round(num * 1_000)
  // "2tr5" = 2.5 triệu handled in extractPriceRange
  if (!unit && num > 0 && num < 1000) return Math.round(num * 1_000_000)
  return Math.round(num)
}

/** "2tr5", "2 trieu 5", "2.5tr" → VND */
function parseCompactMillion(raw: string): number | null {
  const n = normalizeText(raw)
  const m =
    n.match(/(\d+[.,]?\d*)\s*tr\s*(\d)\b/) ??
    n.match(/(\d+)\s*trieu\s*(\d)\b/) ??
    n.match(/(\d+[.,]\d+)\s*tr\b/)
  if (!m) return null
  if (m[2] != null && m[2].length === 1) {
    return Math.round(Number(m[1]) * 1_000_000 + Number(m[2]) * 100_000)
  }
  return Math.round(Number(String(m[1]).replace(',', '.')) * 1_000_000)
}

/** Trích khoảng giá: dưới X · từ X đến Y · X-Y triệu · trên X */
export function extractPriceRange(raw: string): PriceRange | null {
  const n = normalizeText(raw)

  const compact = parseCompactMillion(raw)
  if (compact != null && compact > 0) {
    if (/duoi|under|toi da|max|khong qua|tầm|tam|khoang|ngan sach|budget/.test(n)) {
      return { min: null, max: compact }
    }
    if (/tren|it nhat|>=/.test(n)) return { min: compact, max: null }
    // "tầm 2tr5" → ±10% band
    if (/tam|khoang|around|±/.test(n)) {
      return { min: Math.round(compact * 0.9), max: Math.round(compact * 1.1) }
    }
  }

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
    n.match(/(?:duoi|under|toi da|max|<=|<|khong qua|re hon|co\s*(?:con|gi|sp)?\s*duoi)\s*(\d+[.,]?\d*)\s*(trieu|tr|m|k|cu|cuu|nghin|ngan)?/) ??
    n.match(/(\d+[.,]?\d*)\s*(trieu|tr|cu|cuu)\s*(?:tro xuong|do xuong|thoi|tro lai)?/) ??
    n.match(/(?:trong tam|tam gia|tam|ngan sach|budget|khoang)\s*(?:khoang|around|about)?\s*(\d+[.,]?\d*)\s*(trieu|tr|m|k|cu|cuu)?/) ??
    n.match(/(?:mua|tim|goi y).{0,20}(\d+[.,]?\d*)\s*(trieu|tr|cu|cuu)\s*(?:dong|vnd|thoi)?/)
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

/** Bỏ token giá + động từ tìm kiếm + "loại/danh mục" để lấy từ khóa SP thuần */
const SEARCH_VERB_PREFIX =
  /^(?:tim\s+kiem|tim kiem|tim sp|tim san pham|search for|search|find product|find|lookup|kiem san pham|kiem sp|kiem|goi y tim|muon tim|can tim|xem tim)\s+/i

export function extractProductSearchTerms(raw: string): string {
  let n = stripAffordableMarkers(stripPriceTokens(raw))
  for (let i = 0; i < 4; i++) {
    const stripped = normalizeText(n).replace(SEARCH_VERB_PREFIX, '').trim()
    if (stripped === normalizeText(n)) break
    n = stripped
  }
  n = stripTrailingFillers(normalizeText(n))
  if (isShopCatalogQuestion(n)) return ''
  n = n
    .replace(/^(?:co|shop co)\s+/i, '')
    .replace(/(?<!ban)\s+gi\s*$/, '')
    .replace(/\b(loai|danh muc|category|phan loai|thuoc|thuoc loai|hang|san pham|sp|mon|do)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return n
}

export function findProductsByQuery(products: Product[], query: string): Product[] {
  const cleaned = extractProductSearchTerms(query)
  const normalizedQuery = normalizeText(cleaned || query)
  const originalWords = normalizedQuery
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w))
  const searchPhrases = deriveSearchPhrases(normalizedQuery, originalWords)
  const categoryIntent = detectSearchCategoryIntent(normalizedQuery, originalWords, searchPhrases)
  const expanded = expandQueryTerms(cleaned || query, { search: true })
  const words = expanded.filter((w) => {
    const parts = w.split(/\s+/)
    if (parts.length > 1) return true
    return w.length >= 2 && !STOP_WORDS.has(w)
  })
  if (!words.length && !searchPhrases.length) return []

  const scored = products
    .map((p) => {
      const nameHay = normalizeText(p.name)
      const descHay = normalizeText(p.description ?? '')
      const catHay = normalizeText(p.category ?? '')
      const hay = normalizeText(
        `${p.name} ${p.category} ${p.description} ${p.shopName ?? ''} ${p.sellerEmail ?? ''}`,
      )
      const nameWords = nameHay.split(/\s+/).filter((w) => w.length >= 2)
      let score = 0
      let nameHit = false
      let phraseHit = false
      let categoryHit = false

      for (const phrase of searchPhrases) {
        if (fieldContainsToken(nameHay, phrase)) {
          score += phrase.length * 10
          nameHit = true
          phraseHit = true
        } else if (
          fieldContainsToken(catHay, phrase) ||
          fieldContainsToken(descHay, phrase) ||
          fieldContainsToken(hay, phrase)
        ) {
          score += phrase.length * 3.5
          phraseHit = true
          if (fieldContainsToken(catHay, phrase)) categoryHit = true
        }
      }

      for (const w of originalWords) {
        if (fieldContainsToken(nameHay, w)) {
          score += w.length * 6
          nameHit = true
          continue
        }
        for (const nw of nameWords) {
          if (w.length >= 3 && (fieldContainsToken(nw, w) || (nw.length >= 4 && nw.includes(w)))) {
            score += w.length * 5
            nameHit = true
            break
          }
          if (w.length <= 3 && nw === w) {
            score += w.length * 5
            nameHit = true
            break
          }
        }
        if (fieldContainsToken(descHay, w)) score += w.length * 2
        if (fieldContainsToken(catHay, w)) {
          score += w.length * 1.2
          categoryHit = true
        }
      }

      for (const w of words) {
        if (fieldContainsToken(hay, w)) {
          const inName = fieldContainsToken(nameHay, w)
          const inCat = fieldContainsToken(catHay, w)
          score += w.length * (inName ? (w.includes(' ') ? 3.2 : 2.4) : inCat ? 1.6 : w.includes(' ') ? 1.2 : 0.85)
          if (inName) nameHit = true
          if (inCat) categoryHit = true
          continue
        }
        if (w.includes(' ') || w.length < 3) continue
        if (
          (w === 'bang' || w === 'ban') &&
          (normalizedQuery.includes('may tinh bang') || normalizedQuery.includes('tablet') || normalizedQuery.includes('ipad'))
        ) {
          continue
        }
        for (const hw of hay.split(/\s+/)) {
          if (hw.length < 3) continue
          const sim = wordSimilarity(hw, w)
          if (sim >= 0.82) {
            score += w.length * sim * (fieldContainsToken(nameHay, hw) ? 1 : 0.45)
            if (fieldContainsToken(nameHay, hw)) nameHit = true
          }
        }
      }
      score += Math.min(p.soldCount / 500, 1.5)

      const brandQuery = originalWords.filter((w) => STRICT_BRAND_TERMS.has(w))
      if (brandQuery.length && !nameHit) {
        score *= brandQuery.some((w) => w.length >= 5) ? 0.2 : 0.45
      }

      if (categoryIntent) {
        if (categoryMatchesIntent(catHay, categoryIntent)) {
          score += 14
          categoryHit = true
        }
        if (categoryBlockedByIntent(catHay, categoryIntent) && !nameHit) {
          score *= 0.06
        }
      }

      return { p, score, nameHit, phraseHit, categoryHit }
    })
    .filter((x) => x.score >= 2.5)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.nameHit) - Number(a.nameHit) ||
        Number(b.categoryHit) - Number(a.categoryHit),
    )

  const brandTerm = originalWords.find((w) => STRICT_BRAND_TERMS.has(w) && w.length >= 5)
  if (brandTerm) {
    const brandFocused = scored.filter((x) => x.nameHit)
    if (brandFocused.length) return brandFocused.map((x) => x.p)
    return []
  }

  let picked = scored.filter((x) => x.nameHit)
  if (!picked.length) picked = scored

  if (categoryIntent) {
    const intentFiltered = picked.filter((x) => {
      const catHay = normalizeText(x.p.category ?? '')
      if (categoryBlockedByIntent(catHay, categoryIntent) && !x.nameHit) return false
      if (x.nameHit || x.categoryHit || categoryMatchesIntent(catHay, categoryIntent)) return true
      return x.score >= 10
    })
    if (intentFiltered.length) picked = intentFiltered
  }

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
  _categories: { name: string; slug: string }[] = [],
  limit = 8,
): SmartProductFilterResult {
  const range = extractPriceRange(raw)
  const queryText = extractProductSearchTerms(raw)

  let pool = products.filter((p) => (p.stock ?? 0) > 0)
  pool = applyPriceRange(pool, range)

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
  const meaningfulTerms = queryText.split(/\s+/).filter((w) => w.length >= 3)
  if (queryText.length >= 2) {
    hits = findProductsByQuery(pool, queryText)
    if (!hits.length && range && meaningfulTerms.length === 0) {
      hits = [...pool].sort((a, b) => a.price - b.price)
    }
  } else if (range) {
    hits = [...pool].sort((a, b) => a.price - b.price)
  }

  return {
    products: hits.slice(0, limit),
    range,
    categoryName: null,
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

/** SP mới lên kệ / mới nhất — dùng cho "có món gì mới không". */
export function newestProducts(products: Product[], limit = 6): Product[] {
  return [...products]
    .filter((p) => (p.stock ?? 0) > 0)
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
      if (tb !== ta) return tb - ta
      return (b.soldCount ?? 0) - (a.soldCount ?? 0)
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
