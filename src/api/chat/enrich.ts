import type { ChatContext, ChatEnrichment } from '@/api/chat/context'
import type { ChatIntent } from '@/api/chat/intents'
import { normalizeText, asksProductListedDate, asksProductOrigin, asksProductReview } from '@/api/chat/match'
import { applyPriceRange, extractPriceRange, findProductsByQuery, extractProductSearchTerms, isPriceStatsQuery, looksLikePhone, looksLikeTablet } from '@/api/chat/products'
import { matchCategoryFromText } from '@/api/chat/synonyms'
import {
  demandBriefLive,
  extractDiscountPct,
  inventoryDssBriefLive,
  priceBriefLive,
  sellerWhatIfBriefLive,
} from '@/api/chat/dssBrief'
import { findProductInCatalog } from '@/api/chat/sellerAnalytics'
import { inventoryApi, orderApi, productApi, reviewApi } from '@/api/services'
import type { Product } from '@/types'

const PRODUCT_INTENTS = new Set<ChatIntent>([
  'product_price',
  'product_stock',
  'product_info',
  'product_review',
  'compare',
  'promo',
  'recommend',
  'where_to_buy',
  'contact_seller',
  'product_search',
  'product_cheapest',
  'product_budget',
])

function extractOrderId(raw: string): string | null {
  const m = raw.match(/(?:don|order|#)\s*[#-]?(\d+)/i) ?? raw.match(/\b(o-\d+)\b/i)
  if (!m) return null
  return m[1].startsWith('o-') ? m[1] : m[1]
}

function extractSearchQuery(raw: string): string | null {
  const terms = extractProductSearchTerms(raw)
  if (terms.replace(/\s/g, '').length >= 2) return terms
  const n = normalizeText(raw)
  const patterns = [
    /(?:tim\s+kiem|tim kiem|tim|search|find|kiem)\s+(.+)/,
    /(?:co|ban)\s+(.+?)\s+(?:khong|ko|khong)/,
    /(?:cho nao ban|o dau ban|mua o dau|shop nao ban|ai ban|where to buy)\s+(.+)/,
    /(?:nen mua|goi y|sp nao ngon|hang nao ngon)\s+(.+)/,
  ]
  for (const p of patterns) {
    const m = n.match(p)
    if (m?.[1]) {
      const cleaned = extractProductSearchTerms(m[1])
      if (cleaned.replace(/\s/g, '').length >= 2) return cleaned
    }
  }
  const stripped = n
    .replace(
      /cho nao ban|o dau ban|mua o dau|shop nao ban|ai ban|seller nao|cua hang nao|where to buy|who sells|tim shop|ban o dau|nen mua|goi y|sp nao ngon|hang nao ngon|tot nhat|dang mua/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()
  if (stripped.length > 2 && stripped !== n) {
    const cleaned = extractProductSearchTerms(stripped)
    if (cleaned.replace(/\s/g, '').length >= 2) return cleaned
  }
  return null
}

async function enrichProduct(
  product: Product,
  opts: { reviews?: boolean; inventory?: boolean; detail?: boolean },
): Promise<ChatEnrichment> {
  const out: ChatEnrichment = { productId: product.id, product }

  const tasks: Promise<void>[] = []

  if (opts.detail) {
    tasks.push(
      (async () => {
        out.product = (await productApi.getById(product.id)) ?? product
      })(),
    )
  }

  if (opts.reviews) {
    tasks.push(
      (async () => {
        try {
          out.ratingSummary = await reviewApi.summary(product.id)
        } catch {
          /* summary optional */
        }
        try {
          out.reviews = await reviewApi.list(product.id)
        } catch {
          out.reviews = []
        }
      })(),
    )
  }

  if (opts.inventory) {
    tasks.push(
      (async () => {
        try {
          out.inventory = await inventoryApi.get(product.id)
        } catch {
          out.inventory = null
        }
      })(),
    )
  }

  await Promise.all(tasks)
  return out
}

/** Enrich đúng SP đang focus — tránh dùng enrichment lệch product id. */
export async function enrichFocusProduct(
  product: Product,
  opts: { reviews?: boolean; detail?: boolean } = {},
): Promise<ChatEnrichment> {
  return enrichProduct(product, {
    reviews: opts.reviews ?? false,
    inventory: false,
    detail: opts.detail ?? true,
  })
}

/** Gọi thêm API theo intent / nội dung câu hỏi — tránh gọi dư khi không cần */
export async function enrichChatContext(
  ctx: ChatContext,
  raw: string,
  intent: ChatIntent | null,
  focusProductId?: string,
): Promise<ChatContext> {
  if (intent && ['greeting', 'thanks', 'help', 'platform'].includes(intent)) {
    return ctx
  }

  const enrichment: ChatEnrichment = {}
  const tasks: Promise<void>[] = []

  // Hỏi TB/min/max giá → chỉ cần catalog local, khỏi gọi search/stock thừa
  if (isPriceStatsQuery(raw)) {
    return ctx
  }

  const orderId = extractOrderId(raw)
  if (
    orderId &&
    (intent === 'orders' ||
      intent === 'order_cancel' ||
      intent === 'seller_purchase_orders' ||
      /don|order|#/i.test(raw))
  ) {
    tasks.push(
      (async () => {
        enrichment.focusedOrder = await orderApi.getById(orderId)
      })(),
    )
  }

  const searchQ = extractSearchQuery(raw)
  const isBudgetIntent = intent === 'product_budget'
  if (
    searchQ ||
    intent === 'product_search' ||
    isBudgetIntent ||
    intent === 'where_to_buy' ||
    intent === 'recommend'
  ) {
    tasks.push(
      (async () => {
        // Chip/câu ngân sách ("dưới 2tr") — lấy catalog theo giá, tránh search text nhiễu.
        if (isBudgetIntent && !searchQ) {
          enrichment.searchResults = await productApi.list({
            withStock: false,
            size: 100,
            sort: 'price-asc',
          })
          return
        }
        // "điện thoại dưới 10tr" — chỉ search theo keyword; FE lọc giá.
        // Không merge cả catalog price-asc (dễ lẫn ấm điện / đồ rẻ khác).
        if (isBudgetIntent) {
          enrichment.searchResults = await productApi.list({
            q: searchQ!,
            withStock: false,
            size: 48,
          })
          return
        }
        const q = searchQ ?? raw
        enrichment.searchResults = await productApi.list({ q, withStock: false, size: 48 })
      })(),
    )
  }

  const matchedCat = matchCategoryFromText(raw, ctx.categories)
  if (matchedCat) {
    tasks.push(
      (async () => {
        const byCat = await productApi.list({
          category: matchedCat.name,
          withStock: false,
          size: 48,
        })
        // Điện thoại thường nằm cả ở "Điện tử" — gom thêm nếu danh mục khớp mỏng.
        const needElectronics =
          /dien thoai|smartphone|iphone/i.test(normalizeText(raw)) &&
          !/dien tu/i.test(normalizeText(matchedCat.name))
        if (needElectronics) {
          const elec = await productApi.list({
            category: 'Điện tử',
            withStock: false,
            size: 48,
          })
          const map = new Map<string, (typeof byCat)[0]>()
          for (const p of [...byCat, ...elec]) map.set(String(p.id), p)
          // Ưu tiên SP tên/mô tả có "điện thoại" / phone / iphone
          const merged = [...map.values()]
          const phoneOnly = merged.filter((p) =>
            looksLikePhone(`${p.name} ${p.category} ${p.description ?? ''}`),
          )
          const ranked = (phoneOnly.length ? phoneOnly : merged.filter((p) =>
            !looksLikeTablet(`${p.name} ${p.category} ${p.description ?? ''}`),
          )).sort((a, b) => {
            const score = (p: (typeof byCat)[0]) => {
              const hay = `${p.name} ${p.category} ${p.description ?? ''}`
              if (looksLikeTablet(hay)) return -1
              if (looksLikePhone(hay)) return 2
              if (/điện tử|dien tu/i.test(hay)) return 1
              return 0
            }
            return score(b) - score(a)
          })
          enrichment.categoryProducts = ranked
          return
        }
        enrichment.categoryProducts = byCat
      })(),
    )
  }

  const catalog = ctx.role === 'seller' ? ctx.sellerProducts : ctx.products
  const normalized = normalizeText(raw)
  const matched = findProductsByQuery(catalog, raw)

  let topProduct: Product | undefined
  if (focusProductId) {
    topProduct = catalog.find((p) => String(p.id) === String(focusProductId))
  }
  if (!topProduct) {
    topProduct = matched[0]
  }

  const wantsReviews =
    intent === 'product_review' ||
    intent === 'product_info' ||
    intent === 'recommend' ||
    asksProductReview(normalized)
  const wantsDetail =
    intent === 'product_info' ||
    intent === 'contact_seller' ||
    intent === 'where_to_buy' ||
    asksProductOrigin(normalized) ||
    asksProductListedDate(normalized) ||
    wantsReviews

  if (topProduct && (focusProductId || (intent && PRODUCT_INTENTS.has(intent)) || wantsReviews)) {
    tasks.push(
      (async () => {
        const e = await enrichProduct(topProduct!, {
          reviews: wantsReviews,
          inventory: intent === 'product_stock' || intent === 'product_info',
          detail: wantsDetail,
        })
        Object.assign(enrichment, e)
      })(),
    )
  } else if (focusProductId && wantsReviews) {
    tasks.push(
      (async () => {
        try {
          const fetched = await productApi.getById(focusProductId)
          if (fetched) {
            const e = await enrichProduct(fetched, {
              reviews: true,
              inventory: false,
              detail: true,
            })
            Object.assign(enrichment, e)
          }
        } catch {
          /* card SP có thể chưa sync catalog local */
        }
      })(),
    )
  } else if (topProduct && !intent && matched.length === 1) {
    tasks.push(
      (async () => {
        const e = await enrichProduct(topProduct, { inventory: true })
        Object.assign(enrichment, e)
      })(),
    )
  }

  // Seller DSS intents → real backend analytics (fallback inside *Live helpers)
  if (
    ctx.role === 'seller' &&
    intent &&
    ['seller_dss_demand', 'seller_dss_price', 'seller_dss_inventory', 'seller_pricing', 'seller_whatif'].includes(
      intent,
    )
  ) {
    tasks.push(
      (async () => {
        const focusProduct = findProductInCatalog(catalog, raw)
        if (intent === 'seller_dss_demand') {
          enrichment.dssBriefText = await demandBriefLive(catalog, focusProduct)
        } else if (intent === 'seller_dss_price' || intent === 'seller_pricing') {
          enrichment.dssBriefText = await priceBriefLive(catalog, focusProduct)
        } else if (intent === 'seller_dss_inventory') {
          enrichment.dssBriefText = await inventoryDssBriefLive(catalog)
        } else if (intent === 'seller_whatif') {
          enrichment.dssBriefText = await sellerWhatIfBriefLive(extractDiscountPct(raw, 10), catalog, focusProduct)
        }
      })(),
    )
  }

  await Promise.all(tasks)

  const range = extractPriceRange(raw)
  if (range) {
    if (enrichment.searchResults?.length) {
      enrichment.searchResults = applyPriceRange(enrichment.searchResults, range)
    }
    if (enrichment.categoryProducts?.length) {
      enrichment.categoryProducts = applyPriceRange(enrichment.categoryProducts, range)
    }
  }

  if (!Object.keys(enrichment).length) return ctx
  return { ...ctx, enrichment }
}
