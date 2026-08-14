import { normalizeText } from '@/api/chat/match'

/** Hạt câu hỏi cuối câu — "vậy", "nhỉ", … (ASCII sau normalize). */
const TRAILING_FILLER =
  /\s+(?:vay|vay a|the|nhi|ha|hong|khong|a|o|do|nhe|nha|ban oi|nhi ban|the nao|chua|roi|ma|luon)+\s*$/i

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
  for (let i = 0; i < 4; i++) {
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
    /^(?:web|website|shop|cua hang|sedsp)\s+ban\s+gi(?:\s|$)/.test(n) ||
    /^ban\s+gi(?:\s|$)/.test(n) ||
    /^shop\s+(?:co|ban)\s+gi/.test(n) ||
    /^co\s+ban\s+gi(?:\s|$)/.test(n) ||
    /^what\s+(?:does|do)\s+(?:the\s+)?(?:web|shop|website|store)\s+sell/.test(n) ||
    /^what\s+(?:products|can i buy)/.test(n) ||
    n === 'what do you sell' ||
    n === 'what does the website sell'
  )
}

const VI_TO_EN: Array<{ pattern: RegExp; en: string }> = [
  { pattern: /^(?:web|website|shop|cua hang|sedsp)\s+ban\s+gi/, en: 'what does the website sell' },
  { pattern: /^ban\s+gi(?:\s|$)/, en: 'what does the website sell' },
  { pattern: /^co\s+ban\s+gi/, en: 'what does the website sell' },
  { pattern: /^danh\s+muc/, en: 'product categories' },
  { pattern: /^co\s+tai\s+nghe\s+gi/, en: 'what headphones are available' },
  { pattern: /^co\s+laptop\s+gi/, en: 'what laptops are available' },
  { pattern: /^co\s+dien\s+thoai\s+gi/, en: 'what phones are available' },
  { pattern: /^co\s+may\s+tinh\s+bang\s+gi/, en: 'what tablets are available' },
  { pattern: /san\s+pham\s+nao\s+re\s+nhat|gia\s+re\s+nhat|cheapest/, en: 'cheapest product' },
  { pattern: /^doanh\s+thu|doanh\s+so/, en: 'revenue this month' },
  { pattern: /^ton\s+kho|sap\s+het\s+hang/, en: 'low inventory products' },
  { pattern: /what\s*if|giam\s+gia\s+\d|mo\s+phong/, en: 'what if discount simulation' },
  { pattern: /^gio\s+hang/, en: 'my shopping cart' },
  { pattern: /^don\s+hang/, en: 'my orders' },
]

/** Rule-based VI → EN gloss — không cần LLM cho câu phổ biến. */
export function toEnglishProcessingText(raw: string): string {
  const normalized = stripTrailingFillers(normalizeText(raw))
  for (const rule of VI_TO_EN) {
    if (rule.pattern.test(normalized)) return rule.en
  }
  return normalized
}

export function buildProcessingLocale(raw: string): ProcessingLocale {
  const original = raw.trim()
  const normalized = stripTrailingFillers(normalizeText(original))
  const english = toEnglishProcessingText(original)
  const processing = english
  return { original, normalized, english, processing }
}

/** Gợi ý EN cho LLM reasoning — hiển thị trong prompt, không thay câu user. */
export function englishGlossForPrompt(locale: ProcessingLocale): string {
  if (locale.english !== locale.normalized) return locale.english
  return locale.normalized
}
