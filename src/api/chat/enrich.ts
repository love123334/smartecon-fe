import type { ChatContext, ChatEnrichment } from '@/api/chat/context'
import type { ChatIntent } from '@/api/chat/intents'
import { normalizeText } from '@/api/chat/match'
import { findProductsByQuery } from '@/api/chat/products'
import { matchCategoryFromText } from '@/api/chat/synonyms'
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
  'contact_seller',
  'product_search',
  'product_cheapest',
  'product_budget',
])

const SEARCH_INTENTS = new Set<ChatIntent>(['shop_overview', 'categories', 'category_browse'])

function extractOrderId(raw: string): string | null {
  const m = raw.match(/(?:don|order|#)\s*[#-]?(\d+)/i) ?? raw.match(/\b(o-\d+)\b/i)
  if (!m) return null
  return m[1].startsWith('o-') ? m[1] : m[1]
}

function extractSearchQuery(raw: string): string | null {
  const n = normalizeText(raw)
  const patterns = [
    /(?:tim|search|find|kiem)\s+(.+)/,
    /(?:co|ban)\s+(.+?)\s+(?:khong|ko|khong)/,
  ]
  for (const p of patterns) {
    const m = n.match(p)
    if (m?.[1] && m[1].length > 2) return m[1].trim()
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
        out.ratingSummary = await reviewApi.summary(product.id)
        out.reviews = (await reviewApi.list(product.id)).slice(0, 3)
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

/** Gọi thêm API theo intent / nội dung câu hỏi — tránh gọi dư khi không cần */
export async function enrichChatContext(
  ctx: ChatContext,
  raw: string,
  intent: ChatIntent | null,
): Promise<ChatContext> {
  const enrichment: ChatEnrichment = {}
  const tasks: Promise<void>[] = []

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
  if (searchQ || intent === 'product_search') {
    tasks.push(
      (async () => {
        const q = searchQ ?? raw
        enrichment.searchResults = await productApi.list({ q, withStock: true })
      })(),
    )
  }

  const matchedCat = matchCategoryFromText(raw, ctx.categories)
  if (
    matchedCat &&
    (intent === 'categories' || intent === 'category_browse' || (intent && SEARCH_INTENTS.has(intent)))
  ) {
    tasks.push(
      (async () => {
        enrichment.categoryProducts = await productApi.list({
          category: matchedCat.name,
          withStock: true,
        })
      })(),
    )
  }

  const catalog =
    ctx.role === 'seller' && ctx.sellerProducts.length ? ctx.sellerProducts : ctx.products
  const matched = findProductsByQuery(catalog, raw)
  const topProduct = matched[0]

  if (topProduct && intent && PRODUCT_INTENTS.has(intent)) {
    tasks.push(
      (async () => {
        const e = await enrichProduct(topProduct, {
          reviews: intent === 'product_review' || intent === 'product_info',
          inventory: intent === 'product_stock' || intent === 'product_info',
          detail: intent === 'product_info' || intent === 'contact_seller',
        })
        Object.assign(enrichment, e)
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

  await Promise.all(tasks)

  if (!Object.keys(enrichment).length) return ctx
  return { ...ctx, enrichment }
}
