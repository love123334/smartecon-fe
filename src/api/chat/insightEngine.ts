import type { ChatContext } from '@/api/chat/context'
import { apiConfig } from '@/api/config'
import { formatVnd, normalizeText } from '@/api/chat/match'
import { extractPriceRange, rankRecommendedProducts } from '@/api/chat/products'
import { matchCategoryFromText } from '@/api/chat/synonyms'
import type { ChatCategory } from '@/api/chat/context'
import type { Product } from '@/types'

export type InsightType =
  | 'VALUE_PRODUCT'
  | 'BEST_SELLER_LOW_STOCK'
  | 'SLOW_MOVING'
  | 'CATEGORY_DOMINANT'
  | 'HIGH_RATING_STANDOUT'
  | 'ELECTRONICS_CLUSTER'
  | 'RESTOCK_CANDIDATE'

export interface InsightFact {
  label: string
  value: string
}

export interface ProductInsight {
  type: InsightType
  productId: string
  productName: string
  facts: InsightFact[]
  derived: string[]
  opinion: string
}

export interface CatalogInsightBundle {
  headline: string
  paragraphs: string[]
  productInsights: ProductInsight[]
  suggestedFollowUps: string[]
  highlightProducts: Product[]
  stats: {
    totalProducts: number
    categoryCount: number
    topCategory?: string
    topCategoryCount?: number
  }
}

const ELECTRONICS_CAT = /dien tu|dien thoai|laptop|may tinh|tablet|phu kien|noi com|smart/i

function normalizeCategoryKey(cat: string): string {
  return normalizeText(cat)
}

function categoryCounts(products: Product[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const p of products) {
    const key = p.category?.trim() || 'Khác'
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

function medianSold(products: Product[]): number {
  if (!products.length) return 0
  const sorted = products.map((p) => p.soldCount ?? 0).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function avgPrice(products: Product[]): number {
  if (!products.length) return 0
  return products.reduce((s, p) => s + p.price, 0) / products.length
}

function productFacts(p: Product): InsightFact[] {
  const facts: InsightFact[] = [
    { label: 'Giá', value: formatVnd(p.price) },
    { label: 'Rating', value: `${p.rating}★` },
    { label: 'Đã bán', value: String(p.soldCount ?? 0) },
    { label: 'Tồn', value: String(p.stock ?? 0) },
  ]
  if (p.category) facts.push({ label: 'Danh mục', value: p.category })
  return facts
}

function detectProductInsights(products: Product[], topSellers: Product[]): ProductInsight[] {
  const insights: ProductInsight[] = []
  const medSold = medianSold(products)
  const avg = avgPrice(products)
  const topSoldThreshold = [...products]
    .sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0))
    .slice(0, Math.max(3, Math.ceil(products.length * 0.2)))
    .at(-1)?.soldCount ?? 0

  for (const p of topSellers.slice(0, 8)) {
    const sold = p.soldCount ?? 0
    const stock = p.stock ?? 0
    const rating = p.rating ?? 0

    if (rating >= 4.7 && sold >= medSold && p.price <= avg * 0.65 && p.price <= 8_000_000) {
      insights.push({
        type: 'VALUE_PRODUCT',
        productId: p.id,
        productName: p.name,
        facts: productFacts(p),
        derived: ['Rating cao', 'Doanh số ổn', 'Giá thấp hơn trung bình shop'],
        opinion:
          rating >= 4.95
            ? `**${p.name}** đang nổi bật về value — rating ${rating}★, giá ${formatVnd(p.price)} trong khi bán khá tốt.`
            : `**${p.name}** có combo giá/rating khá hấp dẫn so với mặt bằng shop.`,
      })
    }

    if (sold >= topSoldThreshold && stock > 0 && stock <= 12) {
      insights.push({
        type: 'BEST_SELLER_LOW_STOCK',
        productId: p.id,
        productName: p.name,
        facts: productFacts(p),
        derived: ['Bán chạy', 'Tồn thấp'],
        opinion: `**${p.name}** bán chạy nhưng còn **${stock}** — nên ưu tiên nhập thêm nếu là seller.`,
      })
    }

    if (rating >= 4.95 && sold >= medSold * 0.5) {
      insights.push({
        type: 'HIGH_RATING_STANDOUT',
        productId: p.id,
        productName: p.name,
        facts: productFacts(p),
        derived: ['Rating tối đa/near-max', 'Có lượt mua thực tế'],
        opinion: `**${p.name}** đang có rating **${rating}★** — nếu ưu tiên chất lượng/đánh giá thì đáng xem.`,
      })
    }
  }

  for (const p of products) {
    const sold = p.soldCount ?? 0
    const stock = p.stock ?? 0
    if (stock >= 35 && sold < medSold * 0.35) {
      insights.push({
        type: 'SLOW_MOVING',
        productId: p.id,
        productName: p.name,
        facts: productFacts(p),
        derived: ['Tồn cao', 'Doanh số thấp'],
        opinion: `**${p.name}** tồn **${stock}** nhưng bán chậm — seller có thể cân nhắc khuyến mãi hoặc bundle.`,
      })
    }
    if (sold >= medSold && stock <= 8 && stock > 0) {
      insights.push({
        type: 'RESTOCK_CANDIDATE',
        productId: p.id,
        productName: p.name,
        facts: productFacts(p),
        derived: ['Nhu cầu có', 'Tồn sắp cạn'],
        opinion: `**${p.name}** có dấu hiệu cần nhập thêm — bán **${sold}** lượt, còn **${stock}**.`,
      })
    }
  }

  const deduped = new Map<string, ProductInsight>()
  for (const i of insights) {
    const key = `${i.productId}:${i.type}`
    if (!deduped.has(key)) deduped.set(key, i)
  }
  return [...deduped.values()].slice(0, 5)
}

function electronicsShare(products: Product[]): { count: number; share: number } {
  const tagged = products.filter((p) => ELECTRONICS_CAT.test(normalizeCategoryKey(p.category)))
  return { count: tagged.length, share: products.length ? tagged.length / products.length : 0 }
}

function topCategoryLabel(counts: Map<string, number>): { name: string; count: number } | null {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (!sorted.length) return null
  return { name: sorted[0][0], count: sorted[0][1] }
}

/** Phân tích catalog — không dump list, chỉ highlight + pattern. */
export function buildCatalogInsight(ctx: ChatContext): CatalogInsightBundle {
  const products = ctx.products
  const total = products.length
  const counts = categoryCounts(products)
  const catCount = ctx.categories.length || counts.size
  const topCat = topCategoryLabel(counts)
  const topSellers = [...products].sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0)).slice(0, 5)
  const elec = electronicsShare(products)
  const elecInTop = topSellers.filter((p) => ELECTRONICS_CAT.test(normalizeCategoryKey(p.category))).length

  const productInsights = detectProductInsights(products, topSellers)
  const valuePick = productInsights.find((i) => i.type === 'VALUE_PRODUCT' || i.type === 'HIGH_RATING_STANDOUT')
  const paragraphs: string[] = []

  if (total <= 0) {
    return {
      headline: 'Shop đang cập nhật catalog',
      paragraphs: ['Chưa có đủ sản phẩm để phân tích — thử mở **Cửa hàng** hoặc hỏi theo danh mục cụ thể.'],
      productInsights: [],
      suggestedFollowUps: ['Điện thoại có gì?', 'Dưới 2 triệu', 'Sản phẩm nào rẻ nhất?'],
      highlightProducts: [],
      stats: { totalProducts: 0, categoryCount: 0 },
    }
  }

  paragraphs.push(
    `Shop hiện có **${total}** sản phẩm thuộc **${catCount}** danh mục` +
      (topCat ? ` — **${topCat.name}** đang là nhóm lớn nhất với **${topCat.count}** món.` : '.'),
  )

  if (elec.share >= 0.35 || elecInTop >= 3) {
    paragraphs.push(
      elecInTop >= 3
        ? `Nhìn nhanh thì **công nghệ/điện tử** đang chiếm khá mạnh: **${elecInTop}/${topSellers.length}** sản phẩm bán chạy nhất thuộc nhóm laptop, điện thoại, phụ kiện.`
        : `Nhóm **điện tử** chiếm khoảng **${Math.round(elec.share * 100)}%** catalog — đáng chú ý nếu bạn hay săn đồ công nghệ.`,
    )
    productInsights.unshift({
      type: 'ELECTRONICS_CLUSTER',
      productId: topSellers[0]?.id ?? '',
      productName: topSellers[0]?.name ?? '—',
      facts: [{ label: 'Top seller tech', value: `${elecInTop}/${topSellers.length}` }],
      derived: ['Điện tử dày trong top bán chạy'],
      opinion: 'Xu hướng mua hiện tại nghiêng về điện tử/công nghệ trên shop.',
    })
  }

  if (valuePick) {
    paragraphs.push(valuePick.opinion)
  } else if (topSellers[0]) {
    const p = topSellers[0]
    paragraphs.push(
      `**${p.name}** đang dẫn đầu doanh số (**${p.soldCount ?? 0}** lượt, ${formatVnd(p.price)}, ${p.rating}★) — có thể là điểm vào nhanh nếu chưa biết chọn gì.`,
    )
  }

  const role = ctx.role
  const suggestedFollowUps =
    role === 'seller'
      ? ['Doanh thu tháng này', 'SKU sắp hết', 'What-if giảm 10%']
      : ['Dưới 2 triệu', 'Điện thoại có gì?', 'Sản phẩm nào rẻ nhất?']

  paragraphs.push(
    role === 'seller'
      ? 'Nếu mục tiêu là **tăng doanh thu**, mình có thể soi nhóm bán chạy hoặc SKU sắp hết. Bạn muốn đi theo doanh thu, tồn kho hay rating?'
      : 'Nếu bạn muốn món **rating cao + giá hợp lý**, nói thêm ngân sách (vd. "dưới 2 triệu") để mình lọc sát hơn.',
  )

  return {
    headline: 'Tổng quan shop SEDSP',
    paragraphs,
    productInsights: productInsights.slice(0, 4),
    suggestedFollowUps,
    highlightProducts: topSellers.slice(0, 5),
    stats: {
      totalProducts: total,
      categoryCount: catCount,
      topCategory: topCat?.name,
      topCategoryCount: topCat?.count,
    },
  }
}

export function formatCatalogInsightReply(ctx: ChatContext, bundle: CatalogInsightBundle): string {
  const name = greet(ctx.userName ?? '')
  const offlineHint =
    !ctx.backendOnline && !apiConfig.useMock
      ? '\n\n⚠ Catalog tạm thời hạn chế — thử lại sau hoặc mở **Cửa hàng**.'
      : ''
  const body = bundle.paragraphs.join('\n\n')
  return `${name}${body}${offlineHint}`
}

function greet(userName?: string): string {
  const n = userName?.trim()
  if (n && n.length >= 2 && !/guest|khach hang/i.test(n)) {
    const first = n.split(/\s+/)[0]
    return `${first}, `
  }
  return ''
}

/** Gợi ý / bán chạy — có nhận xét, không chỉ list. */
export function buildRecommendInsight(ctx: ChatContext, products: Product[]): CatalogInsightBundle {
  const ranked = products.length ? products : rankRecommendedProducts(ctx.products, 6)
  const top = ranked.slice(0, 5)
  const insights = detectProductInsights(ctx.products, top)
  const valuePick = insights.find((i) => i.type === 'VALUE_PRODUCT' || i.type === 'HIGH_RATING_STANDOUT')
  const paragraphs: string[] = []

  if (!top.length) {
    return {
      headline: 'Chưa có gợi ý',
      paragraphs: ['Chưa đủ dữ liệu để gợi ý — thử mở **Cửa hàng** hoặc hỏi theo danh mục.'],
      productInsights: [],
      suggestedFollowUps: ['Web bán gì vậy?', 'Dưới 2 triệu'],
      highlightProducts: [],
      stats: { totalProducts: ctx.products.length, categoryCount: ctx.categories.length },
    }
  }

  const cats = new Set(top.map((p) => p.category))
  if (cats.size <= 2 && top[0]?.category) {
    paragraphs.push(
      `Nhóm **${top[0].category}** đang nổi trong các lựa chọn này — **${top.length}** món đáng xem dựa trên rating và lượt bán.`,
    )
  } else {
    paragraphs.push(`Có **${top.length}** gợi ý đáng chú ý — mình nghiêng về **${top[0].name}** trước.`)
  }

  if (valuePick) {
    paragraphs.push(valuePick.opinion)
  }

  const flagship = top.filter((p) => p.price >= 15_000_000)
  const budget = top.filter((p) => p.price <= 5_000_000)
  if (flagship.length && budget.length) {
    paragraphs.push(
      `Có cả nhóm **flagship** (vd. ${flagship[0].name}) lẫn lựa chọn **giá mềm** (vd. ${budget[0].name}) — tùy ngân sách mà chọn hướng.`,
    )
  }

  paragraphs.push('Muốn tui lọc thêm theo **ngân sách** hoặc **danh mục** cụ thể không?')

  return {
    headline: 'Gợi ý sản phẩm',
    paragraphs,
    productInsights: insights.slice(0, 3),
    suggestedFollowUps: ['Dưới 2 triệu', 'So sánh 2 sản phẩm', 'Chỗ nào bán laptop'],
    highlightProducts: top,
    stats: { totalProducts: ctx.products.length, categoryCount: ctx.categories.length },
  }
}

export function formatRecommendInsightReply(ctx: ChatContext, bundle: CatalogInsightBundle): string {
  const name = greet(ctx.userName ?? '')
  return `${name}${bundle.paragraphs.join('\n\n')}`
}

/** Top bán chạy seller — narrative thay vì bullet KPI. */
export function buildSellerTopInsight(ctx: ChatContext, catalog: Product[]): CatalogInsightBundle {
  const top = ctx.salesPerformance?.topProducts ?? []
  const localTop = [...catalog].sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0)).slice(0, 5)
  const paragraphs: string[] = []

  if (top.length) {
    const leader = top[0]
    const totalRev = top.reduce((s, p) => s + (p.revenue ?? 0), 0)
    paragraphs.push(
      `**${leader.productName}** đang dẫn đầu với **${leader.quantitySold}** sp bán và **${formatVnd(leader.revenue)}** doanh thu.`,
    )
    if (top.length >= 2) {
      const runner = top[1]
      paragraphs.push(
        `Theo sau là **${runner.productName}** (${runner.quantitySold} sp). Top **${Math.min(top.length, 3)}** SKU gom khoảng **${Math.round((top.slice(0, 3).reduce((s, p) => s + p.revenue, 0) / (totalRev || 1)) * 100)}%** doanh thu mẫu.`,
      )
    }
    paragraphs.push(
      'Nếu mục tiêu là **tăng doanh thu**, nên đào sâu SKU đang kéo — tui có thể soi **tồn kho, rating hay what-if giá** tiếp.',
    )
  } else if (localTop.length) {
    const insights = detectProductInsights(catalog, localTop)
    paragraphs.push(
      `Trong catalog, **${localTop[0].name}** bán chạy nhất (**${localTop[0].soldCount ?? 0}** lượt, ${formatVnd(localTop[0].price)}).`,
    )
    const valuePick = insights.find((i) => i.type === 'VALUE_PRODUCT')
    if (valuePick) paragraphs.push(valuePick.opinion)
    paragraphs.push('Muốn phân tích theo **doanh thu, tồn kho hay rating**?')
  } else {
    paragraphs.push('Chưa có dữ liệu bán chạy — thêm SP và chờ đơn đầu tiên nhé.')
  }

  const highlightProducts = localTop.length ? localTop : catalog.slice(0, 5)

  return {
    headline: 'Phân tích bán chạy',
    paragraphs,
    productInsights: detectProductInsights(catalog, highlightProducts).slice(0, 3),
    suggestedFollowUps: ['Doanh thu tháng này', 'SKU sắp hết', 'What-if giảm 10%'],
    highlightProducts,
    stats: { totalProducts: catalog.length, categoryCount: ctx.categories.length },
  }
}

export function formatSellerTopInsightReply(ctx: ChatContext, bundle: CatalogInsightBundle): string {
  const name = greet(ctx.userName ?? '')
  return `${name}${bundle.paragraphs.join('\n\n')}`
}

export function serializeInsightsForFacts(bundle: CatalogInsightBundle): string[] {
  const lines: string[] = [`[INSIGHT] ${bundle.headline}`]
  for (const p of bundle.paragraphs) {
    lines.push(`[OPINION] ${p.replace(/\*\*/g, '')}`)
  }
  for (const i of bundle.productInsights) {
    lines.push(`[${i.type}] ${i.productName}: ${i.opinion.replace(/\*\*/g, '')}`)
    for (const f of i.facts) lines.push(`  FACT ${f.label}: ${f.value}`)
  }
  return lines
}

/** SP highlight kèm insight — dùng attach card trong engine. */
export function catalogInsightHighlights(ctx: ChatContext, intent: string | null): Product[] {
  if (intent === 'shop_overview' || intent === 'categories') {
    return buildCatalogInsight(ctx).highlightProducts
  }
  if (intent === 'seller_top_products') {
    const catalog = ctx.sellerProducts
    return buildSellerTopInsight(ctx, catalog).highlightProducts
  }
  if (intent === 'recommend') {
    return buildRecommendInsight(ctx, rankRecommendedProducts(ctx.products, 6)).highlightProducts
  }
  return []
}

export function serializeInsightsForPrompt(bundle: CatalogInsightBundle): string {
  return JSON.stringify(
    {
      headline: bundle.headline,
      stats: bundle.stats,
      opinions: bundle.paragraphs,
      productInsights: bundle.productInsights.map((i) => ({
        type: i.type,
        product: i.productName,
        facts: i.facts,
        derived: i.derived,
        opinion: i.opinion,
      })),
      suggestedFollowUps: bundle.suggestedFollowUps,
    },
    null,
    0,
  )
}

/** Cập nhật state phiên từ lượt hiện tại. */
export function deriveStateFromTurn(
  userMessage: string,
  intent: string | null,
  categories: ChatCategory[] = [],
  products?: { name: string; category?: string }[],
): {
  topic?: string
  userGoal?: string
  currentCategory?: string
  budget?: number
  lastAnalysis?: string
} {
  const normalized = normalizeText(userMessage)
  const range = extractPriceRange(userMessage)
  const budget = range?.max ?? range?.min ?? undefined
  const catMatch = matchCategoryFromText(userMessage, categories)
  let topic: string | undefined
  let userGoal: string | undefined

  if (intent === 'shop_overview' || intent === 'categories') topic = 'catalog_overview'
  else if (
    intent === 'recommend' ||
    intent === 'product_search' ||
    intent === 'category_browse' ||
    intent === 'product_budget'
  ) {
    topic = 'product_recommendation'
  } else if (intent === 'seller_top_products' || intent === 'seller_revenue') {
    topic = 'seller_analytics'
  } else if (intent?.startsWith('product_')) topic = 'product_qa'

  if (/laptop|macbook|dien thoai|iphone|tai nghe|giay|ao |vay/.test(normalized)) {
    userGoal = `buy_${normalized.match(/laptop|macbook|dien thoai|iphone|tai nghe|giay|ao|vay/)?.[0] ?? 'product'}`
  }
  if (/ban chay|doanh thu|top sp|revenue/.test(normalized)) userGoal = 'analyze_sales'
  if (/rating|danh gia|review/.test(normalized)) userGoal = 'find_quality'
  if (budget) userGoal = userGoal ?? 'budget_shopping'

  const currentCategory =
    catMatch?.name ?? products?.[0]?.category ?? (/laptop|macbook/.test(normalized) ? 'Laptop' : undefined)

  return {
    topic,
    userGoal,
    currentCategory,
    budget,
    lastAnalysis: topic === 'catalog_overview' ? 'catalog_patterns' : topic === 'seller_analytics' ? 'top_sellers' : undefined,
  }
}
