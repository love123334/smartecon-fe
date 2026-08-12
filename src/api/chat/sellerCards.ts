import type { ChatContext } from '@/api/chat/context'
import type { ChatIntent } from '@/api/chat/intents'
import { asksSellerInfo, normalizeText } from '@/api/chat/match'
import {
  extractSellerNameQuery,
  findProductsByQuery,
  findProductsBySellerName,
} from '@/api/chat/products'
import { sellerDisplayName, sellerTagCode } from '@/utils/sellerTag'
import type { ChatSellerRef, Product } from '@/types'

function sellerKey(product: Product): string {
  if (product.sellerId?.trim()) return `id:${product.sellerId}`
  return `shop:${normalizeText(product.shopName ?? 'sedsp')}`
}

function productsForSeller(catalog: Product[], product: Product): Product[] {
  const key = sellerKey(product)
  return catalog.filter((p) => sellerKey(p) === key)
}

function aggregateSellerStats(products: Product[]) {
  const rated = products.filter((p) => p.rating > 0)
  const avgRating = rated.length
    ? rated.reduce((sum, p) => sum + p.rating, 0) / rated.length
    : 0
  const totalReviews = products.reduce((sum, p) => sum + (p.reviewCount ?? 0), 0)
  const totalSold = products.reduce((sum, p) => sum + (p.soldCount ?? 0), 0)
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))]
  return { avgRating, totalReviews, totalSold, categories }
}

export function toChatSeller(
  products: Product[],
  opts?: { showContact?: boolean },
): ChatSellerRef | null {
  if (!products.length) return null
  const ranked = [...products].sort(
    (a, b) => b.rating - a.rating || b.soldCount - a.soldCount || a.price - b.price,
  )
  const top = ranked[0]
  const shopName = sellerDisplayName(top)
  const stats = aggregateSellerStats(products)
  const sample = ranked.slice(0, 3)

  return {
    sellerId: top.sellerId || shopName,
    shopName,
    shopLocation: top.shopLocation?.trim() || undefined,
    productCount: products.length,
    avgRating: stats.avgRating > 0 ? Math.round(stats.avgRating * 10) / 10 : undefined,
    totalReviews: stats.totalReviews > 0 ? stats.totalReviews : undefined,
    totalSold: stats.totalSold > 0 ? stats.totalSold : undefined,
    tagCode: sellerTagCode(top.sellerId),
    avatarInitial: shopName.charAt(0).toUpperCase() || 'S',
    topCategories: stats.categories.slice(0, 3),
    sampleProducts: sample.map((p) => ({ id: String(p.id), name: p.name })),
    sellerEmail: opts?.showContact ? top.sellerEmail : undefined,
    sellerPhone: opts?.showContact ? top.sellerPhone : undefined,
    showContact: opts?.showContact,
  }
}

export function toChatSellers(
  products: Product[],
  limit = 5,
  opts?: { showContact?: boolean },
): ChatSellerRef[] {
  const map = new Map<string, Product[]>()
  for (const p of products) {
    const key = sellerKey(p)
    const list = map.get(key) ?? []
    list.push(p)
    map.set(key, list)
  }
  return [...map.values()]
    .map((list) => toChatSeller(list, opts))
    .filter((s): s is ChatSellerRef => Boolean(s))
    .sort((a, b) => (b.totalSold ?? 0) - (a.totalSold ?? 0) || (b.productCount ?? 0) - (a.productCount ?? 0))
    .slice(0, limit)
}

export function sellerCardFromProduct(
  product: Product,
  catalog: Product[],
  opts?: { showContact?: boolean },
): ChatSellerRef | null {
  const scoped = productsForSeller(catalog, product)
  return toChatSeller(scoped.length ? scoped : [product], opts)
}

export function resolveReplySellers(
  ctx: ChatContext,
  intent: ChatIntent | null,
  raw: string,
  catalog: Product[],
  hits: Product[] = [],
): ChatSellerRef[] | undefined {
  const normalized = normalizeText(raw)
  const showContact = intent === 'contact_seller' || asksSellerInfo(normalized)
  const sellerQ = extractSellerNameQuery(raw)

  if (intent === 'contact_seller' || (asksSellerInfo(normalized) && ctx.enrichment?.product)) {
    const focus = ctx.enrichment?.product ?? findProductsByQuery(catalog, raw)[0]
    if (focus) {
      const card = sellerCardFromProduct(focus, catalog, { showContact: true })
      return card ? [card] : undefined
    }
  }

  if (sellerQ) {
    const bySeller = findProductsBySellerName(catalog, sellerQ)
    const cards = toChatSellers(bySeller, 1, { showContact })
    return cards.length ? cards : undefined
  }

  if (intent === 'where_to_buy' && hits.length) {
    const cards = toChatSellers(hits, 5, { showContact: false })
    return cards.length ? cards : undefined
  }

  if (intent === 'recommend' && hits.length) {
    const cards = toChatSellers(hits, 3, { showContact: false })
    return cards.length ? cards : undefined
  }

  return undefined
}
