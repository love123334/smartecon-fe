import { normalizeText } from '@/api/chat/match'

/** Hạt câu hỏi cuối câu — "vậy", "nhỉ", … (ASCII sau normalize). */
const TRAILING_FILLER =
  /\s+(?:vay|vay a|vay ta|the|the nao|nhi|ha|hong|khong|a|o|do|nhe|nha|ban oi|nhi ban|chua|roi|ma|luon|ta|nhe ban|di|chua|sao)+\s*$/i

/** Từ đồng âm sau bỏ dấu — không dùng làm từ khóa tìm SP. */
const HOMOPHONE_FILLER_TOKENS = new Set([
  'vay',
  'the',
  'nhi',
  'ha',
  'nhe',
  'nha',
  'a',
  'o',
  'ma',
  'roi',
  'luon',
  'ta',
  'sao',
  'di',
  'chua',
  'hong',
  'khong',
])

export interface ProcessingLocale {
  /** Câu gốc user gõ (có dấu). */
  original: string
  /** ASCII không dấu, đã bỏ hạt cuối. */
  normalized: string
  /** Bản EN cho intent / search nội bộ. */
  english: string
  /** Luôn dùng field này cho detectIntent & catalog search. */
  processing: string
}

export function stripTrailingFillers(normalized: string): string {
  let n = normalized.trim()
  for (let i = 0; i < 5; i++) {
    const next = n.replace(TRAILING_FILLER, '').trim()
    if (next === n) break
    n = next
  }
  return n
}

/** Hỏi tổng quan shop — không phải tìm SP theo từ khóa. */
export function isShopCatalogQuestion(normalized: string): boolean {
  const n = stripTrailingFillers(normalized)
  return (
    /^(?:web|website|shop|cua hang|sedsp|trang)\s+ban\s+gi(?:\s|$)/.test(n) ||
    /^ban\s+gi(?:\s|$)/.test(n) ||
    /^shop\s+(?:co|ban)\s+gi/.test(n) ||
    /^co\s+ban\s+gi(?:\s|$)/.test(n) ||
    /^web\s+co\s+gi(?:\s|$)/.test(n) ||
    /^hang\s+hoa\s+(?:co|ban)\s+gi/.test(n) ||
    /^what\s+(?:does|do)\s+(?:the\s+)?(?:web|shop|website|store)\s+sell/.test(n) ||
    /^what\s+(?:products|can i buy)/.test(n) ||
    n === 'what do you sell' ||
    n === 'what does the website sell'
  )
}

/** Câu meta — không chạy product search mù. */
export function isMetaShoppingQuestion(normalized: string): boolean {
  const n = stripTrailingFillers(normalized)
  if (isShopCatalogQuestion(n)) return true
  if (/^co\s+gi(?:\s|$)/.test(n) && !/co\s+gi\s+(?:duoi|hay|xin|ngon|tot|dinh|moi|hot|re|de|de mua)/.test(n)) {
    return true
  }
  if (/^danh\s+muc(?:\s|$)|^co\s+may\s+danh\s+muc/.test(n)) return true
  return false
}

/** Phát hiện hạt "vậy" trong câu gốc có dấu. */
export function originalHasVayFiller(original: string): boolean {
  return /vậy|vay\s*\?/i.test(original) || /\bvậy\b/i.test(original)
}

/** Lọc token đồng âm / hạt câu khỏi từ khóa search. */
export function filterHomophoneSearchTokens(words: string[], original = ''): string[] {
  return words.filter((w) => {
    if (w === 'vay' && originalHasVayFiller(original)) return false
    if (HOMOPHONE_FILLER_TOKENS.has(w)) return false
    return true
  })
}

const VI_TO_EN: Array<{ pattern: RegExp; en: string }> = [
  { pattern: /^(?:web|website|shop|cua hang|sedsp|trang)\s+ban\s+gi/, en: 'what does the website sell' },
  { pattern: /^ban\s+gi(?:\s|$)/, en: 'what does the website sell' },
  { pattern: /^co\s+ban\s+gi/, en: 'what does the website sell' },
  { pattern: /^danh\s+muc/, en: 'product categories' },
  { pattern: /san\s+pham\s+nao\s+re\s+nhat|gia\s+re\s+nhat|cheapest|sp\s+nao\s+re/, en: 'cheapest product' },
  { pattern: /^doanh\s+thu|doanh\s+so/, en: 'revenue this month' },
  { pattern: /^ton\s+kho|sap\s+het\s+hang|san\s+pham\s+nao\s+sap\s+het/, en: 'low inventory products' },
  { pattern: /what\s*if|giam\s+gia\s+\d|mo\s+phong/, en: 'what if discount simulation' },
  { pattern: /^gio\s+hang/, en: 'my shopping cart' },
  { pattern: /^don\s+hang|don\s+mua/, en: 'my orders' },
  { pattern: /^co\s+gi\s+duoi\s+\d|duoi\s+\d+\s*(?:trieu|tr|k)/, en: 'products under budget' },
  { pattern: /^co\s+gi\s+hay|co\s+mon\s+gi\s+hay|co\s+gi\s+xin|co\s+gi\s+ngon/, en: 'product recommendations' },
  { pattern: /^co\s+mon\s+gi\s+moi|co\s+gi\s+moi|hang\s+moi/, en: 'new products' },
  { pattern: /^gia\s+bao\s+nhiu|bao\s+nhiu\s+tien/, en: 'product price' },
  { pattern: /^con\s+hang|het\s+hang|còn\s+hang/, en: 'product stock availability' },
  { pattern: /^sedsp\s+la\s+gi|^ve\s+ung\s+dung/, en: 'what is sedsp platform' },
  { pattern: /^don\s+cho|bao\s+nhiu\s+don\s+cho/, en: 'pending orders count' },
  { pattern: /^kpi|^tom\s+tat\s+kpi/, en: 'kpi summary this month' },
]

function applyGenericViToEn(normalized: string): string | null {
  const n = stripTrailingFillers(normalized)
  if (!n) return null

  if (isShopCatalogQuestion(n)) return 'what does the website sell'

  const budget = n.match(/^co\s+gi\s+duoi\s+(\d[\d\s]*(?:trieu|tr|k|nghin)?)/)
  if (budget) return `products under budget ${budget[1].trim()}`

  const catBrowse = n.match(/^(.+?)\s+co\s+gi(?:\s|$)/)
  if (catBrowse) {
    const topic = catBrowse[1].trim()
    if (topic.length >= 2 && !/^(co|shop)$/.test(topic)) {
      return `${topic} category products available`
    }
  }

  const coGi = n.match(/^co\s+(.+?)\s+gi(?:\s|$)/)
  if (coGi) {
    const topic = coGi[1].trim()
    if (
      topic.length >= 2 &&
      !/^(gi|gi duoi|gi hay|gi xin|gi ngon|gi tot|gi moi|gi re|gi do|gi hot)$/.test(topic)
    ) {
      return `what ${topic} are available`
    }
  }

  const tim = n.match(/^(?:tim|kiem|muon\s+tim|can\s+tim)\s+(.+)/)
  if (tim) return `search for ${tim[1].trim()}`

  return null
}

/** Rule-based VI → EN gloss — không cần LLM cho câu phổ biến. */
export function toEnglishProcessingText(raw: string): string {
  const normalized = stripTrailingFillers(normalizeText(raw))

  for (const rule of VI_TO_EN) {
    if (rule.pattern.test(normalized)) return rule.en
  }

  const generic = applyGenericViToEn(normalized)
  if (generic) return generic

  return normalized
}

export function buildProcessingLocale(raw: string): ProcessingLocale {
  const original = raw.trim()
  const normalized = stripTrailingFillers(normalizeText(original))
  const english = toEnglishProcessingText(original)
  return { original, normalized, english, processing: english }
}

/** Chuẩn hóa câu user cho intent / discovery / follow-up. */
export function normalizeUserQuery(raw: string): string {
  return buildProcessingLocale(raw).normalized
}

/** Gợi ý EN cho LLM reasoning — hiển thị trong prompt, không thay câu user. */
export function englishGlossForPrompt(locale: ProcessingLocale): string {
  if (locale.english !== locale.normalized) return locale.english
  return locale.normalized
}

/** Query đã sẵn sàng cho catalog search — rỗng nếu không nên search. */
export function prepareCatalogSearchQuery(raw: string): string {
  const locale = buildProcessingLocale(raw)
  if (isMetaShoppingQuestion(locale.normalized)) return ''

  let n = stripTrailingFillers(normalizeText(raw))
  const searchVerb =
    /^(?:tim\s+kiem|tim kiem|tim sp|tim san pham|search for|search|find product|find|lookup|kiem san pham|kiem sp|kiem|goi y tim|muon tim|can tim|xem tim)\s+/i
  for (let i = 0; i < 4; i++) {
    const stripped = n.replace(searchVerb, '').trim()
    if (stripped === n) break
    n = stripped
  }

  n = n
    .replace(/^(?:co|shop co)\s+/i, '')
    .replace(/(?<!ban)\s+gi\s*$/, '')
    .replace(/\b(loai|danh muc|category|phan loai|hang|san pham|sp|mon)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const words = filterHomophoneSearchTokens(
    n.split(/\s+/).filter((w) => w.length >= 2),
    raw,
  )
  return words.join(' ')
}
