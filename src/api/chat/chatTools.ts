import type { ChatContext } from '@/api/chat/context'
import type { ChatRoute } from '@/api/chat/intentRouter'
import { buildCatalogInsight, serializeInsightsForPrompt } from '@/api/chat/insightEngine'
import { formatVnd } from '@/api/chat/match'
import { getAllowedTools } from '@/api/chat/tools/registry'
import type { ChatToolName, ChatToolResult } from '@/api/chat/tools/types'
import type { VerifiedFacts } from '@/api/chat/verifiedFacts'
import { orderStatusLabel } from '@/utils/orderStatus'
import type { UserRole } from '@/types'

export type { ChatToolName, ChatToolResult } from '@/api/chat/tools/types'
export { getAllowedTools } from '@/api/chat/tools/registry'

function pickSearchProducts(ctx: ChatContext): ChatToolResult {
  const list = ctx.enrichment?.searchResults?.length
    ? ctx.enrichment.searchResults
    : ctx.products.slice(0, 8)
  return {
    name: 'search_products',
    ok: list.length > 0,
    data: {
      count: list.length,
      products: list.slice(0, 6).map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        stock: p.stock,
        category: p.category,
        shop: p.shopName,
      })),
    },
    error: list.length ? undefined : 'NO_RESULTS',
  }
}

function pickProduct(ctx: ChatContext): ChatToolResult {
  const p = ctx.enrichment?.product
  if (!p) {
    return { name: 'get_product', ok: false, data: {}, error: 'NO_PRODUCT_FOCUS' }
  }
  return {
    name: 'get_product',
    ok: true,
    data: {
      id: p.id,
      name: p.name,
      price: p.price,
      stock: p.stock,
      category: p.category,
      shop: p.shopName,
      description: p.description?.slice(0, 280),
      rating: p.rating,
    },
  }
}

function pickInventory(ctx: ChatContext): ChatToolResult {
  const inv = ctx.enrichment?.inventory
  const p = ctx.enrichment?.product
  if (!inv && !p) {
    return { name: 'get_inventory', ok: false, data: {}, error: 'NO_INVENTORY' }
  }
  return {
    name: 'get_inventory',
    ok: true,
    data: {
      productId: p?.id,
      productName: p?.name,
      available: inv?.availableQuantity ?? p?.stock,
      reserved: inv?.reservedQuantity ?? 0,
    },
  }
}

function pickCart(ctx: ChatContext): ChatToolResult {
  return {
    name: 'get_cart',
    ok: true,
    data: {
      itemCount: ctx.cartItemCount,
      total: ctx.cartTotal,
      lines: ctx.cartLines.slice(0, 6).map((l) => ({
        name: l.productName,
        qty: l.quantity,
        subtotal: l.subtotal,
      })),
    },
  }
}

function pickOrders(ctx: ChatContext): ChatToolResult {
  return {
    name: 'get_orders',
    ok: true,
    data: {
      count: ctx.orders.length,
      orders: ctx.orders.slice(0, 6).map((o) => ({
        id: o.id,
        status: orderStatusLabel(o.status),
        total: o.total,
        items: o.items.map((i) => i.productName).slice(0, 3),
      })),
    },
  }
}

function pickSellerSales(ctx: ChatContext): ChatToolResult {
  const perf = ctx.salesPerformance
  if (!perf) {
    return { name: 'get_seller_sales', ok: false, data: {}, error: 'NO_SELLER_SALES' }
  }
  return {
    name: 'get_seller_sales',
    ok: true,
    data: {
      revenue: perf.summary.totalRevenue,
      orders: perf.summary.completedOrders,
      aov: perf.summary.averageOrderValue,
      topProducts: perf.topProducts.slice(0, 5).map((t) => ({
        name: t.productName,
        qty: t.quantitySold,
        revenue: t.revenue,
      })),
    },
  }
}

function pickSellerDashboard(ctx: ChatContext): ChatToolResult {
  const d = ctx.sellerDashboard
  if (!d) {
    return { name: 'get_seller_dashboard', ok: false, data: {}, error: 'NO_DASHBOARD' }
  }
  return {
    name: 'get_seller_dashboard',
    ok: true,
    data: {
      lowStock: d.lowStockProducts.slice(0, 6).map((p) => ({
        name: p.productName,
        qty: p.quantity,
      })),
      recentOrders: d.recentOrders.slice(0, 4).map((o) => ({
        id: o.orderId,
        customer: o.customer,
        total: o.total,
        status: o.status,
      })),
    },
  }
}

function pickDssInsights(ctx: ChatContext): ChatToolResult {
  const insights = ctx.sellerInsights.length ? ctx.sellerInsights : ctx.managerInsights
  if (!insights.length) {
    return { name: 'get_dss_insights', ok: false, data: {}, error: 'NO_DSS' }
  }
  return {
    name: 'get_dss_insights',
    ok: true,
    data: {
      insights: insights.slice(0, 5).map((i) => ({
        title: i.title,
        description: i.description,
        priority: i.priorityLabel ?? i.impact,
      })),
    },
  }
}

function pickManagerKpi(ctx: ChatContext): ChatToolResult {
  const orders = ctx.orders
  const revenue = orders.reduce((s, o) => s + (o.total ?? 0), 0)
  return {
    name: 'get_manager_kpi',
    ok: true,
    data: {
      orderSample: orders.length,
      revenueSample: revenue,
      pendingInsights: ctx.managerInsights.filter((i) => /pending|cho/i.test(i.title)).length,
    },
  }
}

function pickCatalogInsights(ctx: ChatContext): ChatToolResult {
  const bundle = buildCatalogInsight(ctx)
  return {
    name: 'get_catalog_insights',
    ok: bundle.stats.totalProducts > 0,
    data: JSON.parse(serializeInsightsForPrompt(bundle)) as Record<string, unknown>,
    error: bundle.stats.totalProducts ? undefined : 'EMPTY_CATALOG',
  }
}

const EXECUTORS: Record<
  ChatToolName,
  (ctx: ChatContext) => ChatToolResult
> = {
  search_products: pickSearchProducts,
  get_product: pickProduct,
  get_inventory: pickInventory,
  get_cart: pickCart,
  get_orders: pickOrders,
  get_seller_sales: pickSellerSales,
  get_seller_dashboard: pickSellerDashboard,
  get_dss_insights: pickDssInsights,
  get_manager_kpi: pickManagerKpi,
  get_catalog_insights: pickCatalogInsights,
}

/** Gọi tool local (RBAC đã lọc) — dữ liệu từ enrich + facts, không bịa. */
export function executeLocalChatTools(
  role: UserRole,
  route: ChatRoute,
  ctx: ChatContext,
): ChatToolResult[] {
  const allowed = getAllowedTools(role, route)
  const results: ChatToolResult[] = []
  for (const name of allowed) {
    const exec = EXECUTORS[name]
    if (!exec) continue
    const result = exec(ctx)
    results.push(result)
  }
  return results
}

export function formatToolResultsForPrompt(results: ChatToolResult[]): string {
  if (!results.length) return '—'
  return results
    .map((r) => {
      const status = r.ok ? 'OK' : `ERR:${r.error ?? 'FAIL'}`
      return `[${r.name}] ${status}\n${JSON.stringify(r.data, null, 0)}`
    })
    .join('\n\n')
}

export function formatVerifiedFactsCompact(facts: VerifiedFacts): string {
  const lines = facts.lines.slice(0, 12)
  const prices = facts.verifiedPricesVnd.slice(0, 4).map(formatVnd)
  const names = facts.allowedProductNames.slice(0, 4)
  const chunks: string[] = []
  if (lines.length) chunks.push(lines.join('\n'))
  if (facts.insights) {
    chunks.push(`INSIGHTS: ${serializeInsightsForPrompt(facts.insights)}`)
  }
  if (names.length) chunks.push(`SP: ${names.join(', ')}`)
  if (prices.length) chunks.push(`Giá: ${prices.join(', ')}`)
  if (facts.localDraft?.trim()) {
    chunks.push(`Draft: ${facts.localDraft.trim().slice(0, 500)}`)
  }
  return chunks.join('\n') || '—'
}
