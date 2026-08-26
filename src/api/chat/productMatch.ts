import { containsWholePhrase, fieldContainsToken, normalizeText } from '@/api/chat/match'
import { findProductsByQuery } from '@/api/chat/products'
import type { Product } from '@/types'

export type ProductMatchTier = 'exact' | 'specific' | 'broad' | 'none' | 'alternative'

export interface SpecificProductType {
  id: string
  phrases: string[]
  label: string
  /** Parent term — không được match chỉ bằng parent khi user hỏi cụ thể */
  parentTerms: string[]
}

/** Subtype cụ thể — không downgrade sang parent (vd. áo khoác → áo thun). */
export const SPECIFIC_PRODUCT_TYPES: SpecificProductType[] = [
  {
    id: 'jacket',
    phrases: ['ao khoac', 'jacket', 'hoodie', 'ao giu nhiet', 'khoac nam', 'khoac nu', 'windbreaker'],
    label: 'áo khoác',
    parentTerms: ['ao'],
  },
  {
    id: 'tshirt',
    phrases: ['ao thun', 't shirt', 'tshirt', 'tee', 'polo'],
    label: 'áo thun',
    parentTerms: ['ao'],
  },
  {
    id: 'dress_shirt',
    phrases: ['ao so mi', 'so mi nam', 'so mi nu', 'dress shirt'],
    label: 'áo sơ mi',
    parentTerms: ['ao'],
  },
  {
    id: 'gaming_phone',
    phrases: ['dien thoai gaming', 'phone gaming', 'smartphone gaming'],
    label: 'điện thoại gaming',
    parentTerms: ['dien thoai', 'smartphone'],
  },
  {
    id: 'iphone_model',
    phrases: ['iphone 15', 'iphone 14', 'iphone 13', 'iphone 16'],
    label: 'iPhone',
    parentTerms: ['iphone', 'dien thoai'],
  },
]

export interface ProductSearchResult {
  matchTier: ProductMatchTier
  products: Product[]
  specificLabel?: string
  allowCards: boolean
  /** Chỉ attach card khi user hỏi alternative hoặc query broad */
  allowAlternatives: boolean
  alternativeProducts: Product[]
  queryText: string
}

function detectSpecificProductType(normalizedQuery: string): SpecificProductType | null {
  let best: { type: SpecificProductType; len: number } | null = null
  for (const type of SPECIFIC_PRODUCT_TYPES) {
    for (const phrase of type.phrases) {
      if (
        containsWholePhrase(normalizedQuery, phrase) ||
        normalizedQuery.includes(phrase)
      ) {
        if (!best || phrase.length > best.len) {
          best = { type, len: phrase.length }
        }
      }
    }
  }
  return best?.type ?? null
}

function productMatchesSpecificType(p: Product, type: SpecificProductType): boolean {
  const hay = normalizeText(`${p.name} ${p.description ?? ''} ${p.category ?? ''}`)
  return type.phrases.some(
    (ph) => containsWholePhrase(hay, ph) || fieldContainsToken(hay, ph),
  )
}

function findRelatedAlternatives(
  catalog: Product[],
  type: SpecificProductType,
  excludeIds: Set<string>,
  limit = 4,
): Product[] {
  const parent = type.parentTerms[0]
  if (!parent) return []
  return findProductsByQuery(catalog, parent)
    .filter((p) => !excludeIds.has(String(p.id)))
    .filter((p) => !productMatchesSpecificType(p, type))
    .slice(0, limit)
}

export function asksProductAlternative(normalizedQuery: string): boolean {
  return /tuong tu|alternative|thay the|khac duoc khong|con gi khac|neu khong co|khong co thi|goi y khac|loai ao khac/.test(
    normalizedQuery,
  )
}

export function asksProductAvailability(normalizedQuery: string): boolean {
  return /co ban khong|co khong|co .* khong|shop co|con hang khong|tim .* co/.test(normalizedQuery)
}

/**
 * Retrieval + validation — LLM không được tự quyết match.
 */
export function searchProductsWithPolicy(
  catalog: Product[],
  rawQuery: string,
): ProductSearchResult {
  const n = normalizeText(rawQuery)
  const specific = detectSpecificProductType(n)
  const wantAlternative = asksProductAlternative(n)

  if (!specific) {
    const products = findProductsByQuery(catalog, rawQuery).slice(0, 5)
    return {
      matchTier: products.length ? 'broad' : 'none',
      products,
      allowCards: products.length > 0,
      allowAlternatives: true,
      alternativeProducts: [],
      queryText: rawQuery,
    }
  }

  const exact = catalog.filter((p) => productMatchesSpecificType(p, specific))
  if (exact.length) {
    return {
      matchTier: 'exact',
      products: exact.slice(0, 5),
      specificLabel: specific.label,
      allowCards: true,
      allowAlternatives: false,
      alternativeProducts: [],
      queryText: rawQuery,
    }
  }

  const alternatives = findRelatedAlternatives(catalog, specific, new Set())

  return {
    matchTier: 'none',
    products: [],
    specificLabel: specific.label,
    allowCards: wantAlternative && alternatives.length > 0,
    allowAlternatives: true,
    alternativeProducts: wantAlternative ? alternatives : [],
    queryText: rawQuery,
  }
}

/** Natural reply khi không có exact match — không attach card trừ khi alternative. */
export function presentProductSearchResult(
  result: ProductSearchResult,
  userName?: string,
): string {
  const name =
    userName?.trim() && userName.length >= 2 && !/guest|khach hang/i.test(userName)
      ? `${userName.trim().split(/\s+/)[0]}, `
      : ''

  if (result.matchTier === 'none' && result.specificLabel) {
    if (result.allowCards && result.alternativeProducts.length) {
      const pick = result.alternativeProducts[0]?.name
      return pick
        ? `${name}Shop chưa có **${result.specificLabel}**. Thay vào đó có vài lựa chọn khác — mình nghiêng về **${pick}** nếu bạn muốn xem alternative.`
        : `${name}Shop chưa có **${result.specificLabel}**.`
    }
    return `${name}Hiện shop chưa có **${result.specificLabel}**. Nếu bạn muốn, mình có thể tìm các loại liên quan đang có.`
  }

  if (!result.products.length) {
    return `${name}Mình chưa thấy mẫu khớp trên shop. Thử từ khóa khác hoặc nới điều kiện một chút?`
  }

  const pick = result.products[0]?.name
  if (result.matchTier === 'exact' && pick) {
    return `${name}Có **${result.specificLabel ?? 'mẫu này'}** — mình nghiêng về **${pick}** trước.`
  }
  return pick
    ? `${name}Có vài lựa chọn ổn — mình nghiêng về **${pick}** trước.`
    : `${name}Có vài lựa chọn ổn.`
}
