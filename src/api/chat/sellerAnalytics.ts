import { formatVnd, normalizeText } from '@/api/chat/match'
import {
  filterOrdersBySpec,
  parseOrderQuery,
  presentOrdersReply,
  type OrderQuerySpec,
} from '@/api/chat/orderQuery'
import type { ChatContext } from '@/api/chat/context'
import type { ChatIntent } from '@/api/chat/intents'
import type { Order, Product } from '@/types'
import type { SalesPerformance, SellerDashboard } from '@/api/real/seller'

export type SellerPeriodType =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'last_30_days'
  | 'all'
  | 'compare_month'

export type SellerMetricFocus =
  | 'revenue'
  | 'orders'
  | 'profit'
  | 'inventory'
  | 'products'
  | 'health'
  | 'dss_explain'
  | 'restock'
  | 'general'

export type SellerDetailLevel = 'summary' | 'detail' | 'comparison'

export interface SellerAnalyticsSpec {
  period: SellerPeriodType
  metric: SellerMetricFocus
  detailLevel: SellerDetailLevel
  comparePrevious: boolean
  productQuery?: string
}

export interface RevenueSlice {
  label: string
  revenue: number
  orders?: number
}

export interface RevenueComparison {
  current: RevenueSlice
  previous?: RevenueSlice
  changePct: number | null
  trend: 'up' | 'down' | 'flat' | 'unknown'
}

export interface ProfitSnapshot {
  revenue: number
  cogs: number
  grossProfit: number
  grossMarginPct: number | null
  inventoryCapital: number
  hasCostData: boolean
  topByProfit: Array<{ name: string; profit: number; marginPct: number | null }>
}

export type BusinessHealthStatus = 'healthy' | 'stable' | 'needs_attention' | 'at_risk' | 'unknown'

export interface BusinessHealthReport {
  status: BusinessHealthStatus
  statusLabel: string
  revenueComparison: RevenueComparison | null
  orderCount: number
  aov: number
  lowStockCount: number
  topProduct?: string
  positives: string[]
  risks: string[]
  actions: string[]
}

function pctChange(current: number, previous: number): number | null {
  if (!previous || previous <= 0) return current > 0 ? 100 : null
  return ((current - previous) / previous) * 100
}

function trendFromChange(pct: number | null): RevenueComparison['trend'] {
  if (pct == null) return 'unknown'
  if (pct > 2) return 'up'
  if (pct < -2) return 'down'
  return 'flat'
}

function formatPct(pct: number | null): string {
  if (pct == null) return '—'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

export function defaultSellerAnalyticsSpec(): SellerAnalyticsSpec {
  return {
    period: 'this_month',
    metric: 'general',
    detailLevel: 'summary',
    comparePrevious: false,
  }
}

/** Parse business question → structured spec (temporal + metric + detail). */
export function parseSellerBusinessQuery(
  raw: string,
  intent: ChatIntent | null,
  prior?: Partial<SellerAnalyticsSpec>,
): SellerAnalyticsSpec {
  const n = normalizeText(raw)
  const spec: SellerAnalyticsSpec = {
    ...defaultSellerAnalyticsSpec(),
    ...prior,
  }

  if (/chi tiet|phan tich sau|tom tat day du|comprehensive/.test(n)) {
    spec.detailLevel = 'detail'
  } else if (/tai sao|vi sao|ly do|giai thich/.test(n)) {
    spec.detailLevel = 'comparison'
    spec.comparePrevious = true
  }

  if (/hom nay|today/.test(n)) spec.period = 'today'
  else if (/tuan nay|this week|trong tuan/.test(n)) spec.period = 'this_week'
  else if (/thang truoc|last month|thang vua roi/.test(n)) spec.period = 'last_month'
  else if (/30 ngay|rolling 30|gan day/.test(n)) spec.period = 'last_30_days'
  else if (/thang nay|this month|trong thang/.test(n)) spec.period = 'this_month'

  if (/so voi|tang hay giam|tang hay giam|hon thang|compare|doi chieu|so sanh thang/.test(n)) {
    spec.period = 'compare_month'
    spec.comparePrevious = true
  }

  if (
    intent === 'seller_business_health' ||
    /shop.*(the nao|sao roi|kinh doanh)|suc khoe|business health|tinh hinh shop|shop dang/.test(n)
  ) {
    spec.metric = 'health'
  } else if (
    intent === 'seller_profit' ||
    /loi nhuan|profit|margin|gross|von|chi phi|gia von|bo bao nhieu von|kiem duoc bao nhieu/.test(n)
  ) {
    spec.metric = 'profit'
  } else if (
    intent === 'seller_dss_explain' ||
    /dss la gi|dss giup|dss cua sedsp|he thong ho tro quyet dinh/.test(n)
  ) {
    spec.metric = 'dss_explain'
  } else if (/nhap them|restock|nhap hang|nen nhap|sap het|ton kho thap/.test(n)) {
    spec.metric = 'restock'
  } else if (/ton kho|inventory|het hang|overstock/.test(n)) {
    spec.metric = 'inventory'
  } else if (/ban cham|worst|loi nhat|loi nhieu|margin cao|ban chay|top product|sp ban/.test(n)) {
    spec.metric = 'products'
  } else if (/doanh thu|revenue|doanh so|ban duoc bao nhieu/.test(n)) {
    spec.metric = 'revenue'
  } else if (/don hang|don ban|bao nhieu don|order count/.test(n)) {
    spec.metric = 'orders'
  }

  if (prior?.metric && prior.metric !== 'general' && spec.metric === 'general') {
    spec.metric = prior.metric
  }
  if (prior?.period && spec.period === 'this_month' && !/hom nay|tuan|thang|30 ngay/.test(n)) {
    spec.period = prior.period
  }

  return spec
}

export function findProductInCatalog(catalog: Product[], raw: string): Product | null {
  const n = normalizeText(raw)
  let best: { p: Product; score: number } | null = null
  for (const p of catalog) {
    const hay = normalizeText(`${p.name} ${p.category ?? ''}`)
    const tokens = hay.split(/\s+/).filter((w) => w.length >= 3)
    let score = 0
    for (const t of tokens) {
      if (n.includes(t)) score += t.length
    }
    if (containsWholeProductName(n, hay)) score += 20
    if (score > 0 && (!best || score > best.score)) best = { p, score }
  }
  return best?.p ?? null
}

function containsWholeProductName(query: string, hay: string): boolean {
  const qTokens = query.split(/\s+/).filter((w) => w.length >= 4)
  if (qTokens.length < 2) return false
  return qTokens.filter((t) => hay.includes(t)).length >= Math.min(2, qTokens.length)
}

/** Revenue từ monthlyRevenue — tháng cuối = tháng gần nhất có dữ liệu. */
export function buildRevenueComparison(perf: SalesPerformance): RevenueComparison | null {
  const months = perf.monthlyRevenue.filter((m) => m.value > 0)
  if (!months.length) return null
  const current = months[months.length - 1]
  const previous = months.length >= 2 ? months[months.length - 2] : undefined
  const change = previous ? pctChange(current.value, previous.value) : null
  return {
    current: { label: current.label, revenue: current.value },
    previous: previous ? { label: previous.label, revenue: previous.value } : undefined,
    changePct: change,
    trend: trendFromChange(change),
  }
}

export function computeProfitSnapshot(catalog: Product[], perf?: SalesPerformance | null): ProfitSnapshot {
  const withCost = catalog.filter((p) => typeof p.costPrice === 'number' && p.costPrice > 0)
  const revenue = perf?.summary.totalRevenue ?? catalog.reduce((s, p) => s + p.soldCount * p.price, 0)

  if (!withCost.length) {
    return {
      revenue,
      cogs: 0,
      grossProfit: 0,
      grossMarginPct: null,
      inventoryCapital: 0,
      hasCostData: false,
      topByProfit: [],
    }
  }

  let cogs = 0
  let grossProfit = 0
  let inventoryCapital = 0
  const byProfit: ProfitSnapshot['topByProfit'] = []

  for (const p of withCost) {
    const cost = p.costPrice!
    const soldRevenue = p.soldCount * p.price
    const soldCogs = p.soldCount * cost
    cogs += soldCogs
    const profit = soldRevenue - soldCogs
    grossProfit += profit
    inventoryCapital += p.stock * cost
    if (p.soldCount > 0) {
      byProfit.push({
        name: p.name,
        profit,
        marginPct: soldRevenue > 0 ? (profit / soldRevenue) * 100 : null,
      })
    }
  }

  byProfit.sort((a, b) => b.profit - a.profit)

  return {
    revenue,
    cogs,
    grossProfit,
    grossMarginPct: revenue > 0 ? (grossProfit / revenue) * 100 : null,
    inventoryCapital,
    hasCostData: true,
    topByProfit: byProfit.slice(0, 5),
  }
}

export function buildBusinessHealth(
  ctx: ChatContext,
  catalog: Product[],
): BusinessHealthReport {
  const perf = ctx.salesPerformance
  const dash = ctx.sellerDashboard
  const revCmp = perf ? buildRevenueComparison(perf) : null
  const lowStock = dash?.lowStockProducts.length ?? catalog.filter((p) => p.stock > 0 && p.stock < 15).length
  const outStock = catalog.filter((p) => p.stock <= 0).length
  const top = perf?.topProducts[0]?.productName ?? [...catalog].sort((a, b) => b.soldCount - a.soldCount)[0]?.name

  const positives: string[] = []
  const risks: string[] = []
  const actions: string[] = []

  if (revCmp?.trend === 'up' && revCmp.changePct != null) {
    positives.push(`Doanh thu tháng gần nhất tăng khoảng **${formatPct(revCmp.changePct)}** so với tháng trước.`)
  } else if (revCmp?.trend === 'flat') {
    positives.push('Doanh thu đang khá ổn định qua các tháng gần đây.')
  }

  if (perf && perf.summary.completedOrders >= 5) {
    positives.push(`Có **${perf.summary.completedOrders}** đơn hoàn tất — lượng bán đang có đà.`)
  }

  if (top) {
    positives.push(`**${top}** đang là sản phẩm đóng góp nhiều nhất.`)
  }

  if (revCmp?.trend === 'down' && revCmp.changePct != null) {
    risks.push(`Doanh thu giảm khoảng **${Math.abs(revCmp.changePct).toFixed(1)}%** so với tháng trước — cần xem lại SP chủ lực.`)
  }

  if (lowStock > 0) {
    risks.push(`**${lowStock}** SKU đang sát ngưỡng tồn kho${outStock ? ` (${outStock} hết hàng)` : ''}.`)
    const first = dash?.lowStockProducts[0]?.productName
    actions.push(first ? `Ưu tiên nhập thêm **${first}** trước khi hết hàng.` : 'Chạy **DSS → Khuyến nghị tồn kho** để biết số lượng nhập.')
  }

  if (!positives.length && perf?.summary.totalRevenue) {
    positives.push(`Shop đã ghi nhận **${formatVnd(perf.summary.totalRevenue)}** doanh thu tích lũy.`)
  }

  if (!actions.length && revCmp?.trend === 'up') {
    actions.push('Giữ đà bằng cách theo dõi tồn kho SP bán chạy và thử what-if giảm giá nếu cần.')
  }

  let status: BusinessHealthStatus = 'unknown'
  if (revCmp?.trend === 'up' && lowStock <= 1) status = 'healthy'
  else if (revCmp?.trend === 'flat' && lowStock <= 2) status = 'stable'
  else if (revCmp?.trend === 'down' && lowStock >= 2) status = 'at_risk'
  else if (revCmp?.trend === 'down' || lowStock >= 3) status = 'needs_attention'
  else if (perf?.summary.totalRevenue) status = 'stable'

  const statusLabel =
    status === 'healthy'
      ? 'Khá tốt'
      : status === 'stable'
        ? 'Ổn định'
        : status === 'needs_attention'
          ? 'Cần chú ý'
          : status === 'at_risk'
            ? 'Có rủi ro'
            : 'Chưa đủ dữ liệu'

  return {
    status,
    statusLabel,
    revenueComparison: revCmp,
    orderCount: perf?.summary.completedOrders ?? ctx.orders.length,
    aov: perf?.summary.averageOrderValue ?? 0,
    lowStockCount: lowStock,
    topProduct: top,
    positives,
    risks,
    actions,
  }
}

export function presentDssExplain(): string {
  return [
    '**DSS** (Decision Support System) là hệ thống hỗ trợ ra quyết định trên SEDSP.',
    '',
    'Với shop của bạn, DSS hiện có:',
    '• **Dự báo nhu cầu** — dự đoán lượng bán dựa trên đơn đã giao',
    '• **Khuyến nghị giá** — gợi ý mức giá từ lịch sử bán',
    '• **Khuyến nghị tồn kho** — ROP và số lượng nên nhập',
    '• **What-if giảm giá** — mô phỏng doanh số / lợi nhuận khi đổi giá',
    '',
    'Mình **không tự bịa số** — mọi con số đều từ API DSS hoặc dashboard shop.',
  ].join('\n')
}

export function presentRevenueReply(
  perf: SalesPerformance,
  spec: SellerAnalyticsSpec,
  userName?: string,
): string {
  const name = sellerGreet(userName)
  const cmp = buildRevenueComparison(perf)

  if (spec.period === 'compare_month' || spec.comparePrevious) {
    if (!cmp?.previous) {
      return `${name}Chưa đủ dữ liệu 2 tháng để so sánh. Hiện **${cmp?.current.label ?? 'kỳ gần nhất'}**: **${formatVnd(cmp?.current.revenue ?? perf.summary.totalRevenue)}**.`
    }
    const dir =
      cmp.trend === 'up' ? 'tăng' : cmp.trend === 'down' ? 'giảm' : 'gần như giữ nguyên'
    return `${name}**${cmp.current.label}** shop đạt **${formatVnd(cmp.current.revenue)}**, ${dir} khoảng **${formatPct(cmp.changePct)}** so với **${cmp.previous.label}** (${formatVnd(cmp.previous.revenue)}).${
      perf.topProducts[0]
        ? ` Phần lớn đến từ **${perf.topProducts[0].productName}**.`
        : ''
    }`
  }

  if (spec.detailLevel === 'summary') {
    const slice = cmp?.current
    return `${name}Doanh thu **${slice?.label ?? 'tích lũy'}** khoảng **${formatVnd(slice?.revenue ?? perf.summary.totalRevenue)}** · **${perf.summary.completedOrders}** đơn HT · AOV **${formatVnd(perf.summary.averageOrderValue)}**.`
  }

  const chart = perf.monthlyRevenue
    .slice(-4)
    .map((m) => `• ${m.label}: **${formatVnd(m.value)}**`)
    .join('\n')
  const top = perf.topProducts
    .slice(0, 3)
    .map((p) => `• **${p.productName}**: ${p.quantitySold} sp · ${formatVnd(p.revenue)}`)
    .join('\n')
  return `${name}**Doanh thu theo tháng:**\n${chart}\n\n**Top sản phẩm:**\n${top}`
}

export function presentProfitReply(profit: ProfitSnapshot, userName?: string): string {
  const name = sellerGreet(userName)
  if (!profit.hasCostData) {
    return `${name}Hệ thống chưa có **giá vốn (costPrice)** trên sản phẩm nên mình chưa tính được gross profit chính xác. Cập nhật giá vốn ở **Quản lý SP** rồi hỏi lại nhé.\n\nDoanh thu tích lũy (API): **${formatVnd(profit.revenue)}**.`
  }
  const margin = profit.grossMarginPct != null ? `${profit.grossMarginPct.toFixed(1)}%` : '—'
  let msg = `${name}**Gross profit** (từ giá vốn SP): **${formatVnd(profit.grossProfit)}** · margin ~**${margin}** · vốn tồn kho ~**${formatVnd(profit.inventoryCapital)}**.\n\n*Chưa có chi phí vận hành/quảng cáo — đây không phải lợi nhuận ròng.*`
  if (profit.topByProfit.length) {
    const top = profit.topByProfit[0]
    msg += `\n\nSP lời nhất hiện tại: **${top.name}** (~**${formatVnd(top.profit)}** gross).`
  }
  return msg
}

export function presentBusinessHealthReply(report: BusinessHealthReport, userName?: string): string {
  const name = sellerGreet(userName)
  const parts = [`${name}Nhìn chung shop đang **${report.statusLabel.toLowerCase()}**.`]

  if (report.revenueComparison?.changePct != null) {
    parts.push(
      `Doanh thu tháng gần nhất **${formatPct(report.revenueComparison.changePct)}** so với tháng trước.`,
    )
  }

  if (report.positives.length) {
    parts.push('\n**Tín hiệu tích cực:**\n' + report.positives.map((p) => `• ${p}`).join('\n'))
  }
  if (report.risks.length) {
    parts.push('\n**Rủi ro / cần chú ý:**\n' + report.risks.map((p) => `• ${p}`).join('\n'))
  }
  if (report.actions.length) {
    parts.push('\n**Gợi ý:**\n' + report.actions.map((p) => `• ${p}`).join('\n'))
  }

  return parts.join('')
}

export function presentRestockReply(dash: SellerDashboard | null | undefined, catalog: Product[], userName?: string): string {
  const name = sellerGreet(userName)
  const fromDash = dash?.lowStockProducts ?? []
  const fromCat = catalog
    .filter((p) => p.stock > 0 && p.stock < 20)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5)
    .map((p) => ({ productName: p.name, quantity: p.stock }))

  const list = fromDash.length ? fromDash : fromCat
  if (!list.length) {
    return `${name}Chưa thấy SKU sắp hết hàng trên dashboard. Hỏi **"khuyến nghị tồn kho"** để DSS tính ROP chính xác hơn.`
  }

  const ranked = list.slice(0, 3).map((p, i) => `${i + 1}. **${p.productName}** — còn **${p.quantity}**`)
  return `${name}**Ưu tiên nhập thêm:**\n${ranked.join('\n')}\n\nChạy **DSS → Khuyến nghị tồn kho** để biết số lượng cụ thể.`
}

export function presentSellerOrdersReply(
  orders: Order[],
  raw: string,
  prior?: OrderQuerySpec,
  userName?: string,
): string {
  const { spec } = parseOrderQuery(raw, prior)
  const filtered = filterOrdersBySpec(orders, spec)
  return presentOrdersReply(filtered, spec, { userName })
}

export function presentSellerAnalyticsFacts(
  ctx: ChatContext,
  spec: SellerAnalyticsSpec,
): string {
  const catalog = ctx.sellerProducts.length ? ctx.sellerProducts : ctx.products
  if (spec.metric === 'health') {
    const h = buildBusinessHealth(ctx, catalog)
    return `Sức khỏe shop: ${h.statusLabel}; đơn HT ${h.orderCount}; tồn thấp ${h.lowStockCount}`
  }
  if (spec.metric === 'revenue' && ctx.salesPerformance) {
    const cmp = buildRevenueComparison(ctx.salesPerformance)
    return cmp
      ? `Doanh thu ${cmp.current.label}: ${formatVnd(cmp.current.revenue)}; Δ ${formatPct(cmp.changePct)}`
      : `Doanh thu tổng: ${formatVnd(ctx.salesPerformance.summary.totalRevenue)}`
  }
  if (spec.metric === 'profit') {
    const p = computeProfitSnapshot(catalog, ctx.salesPerformance)
    return p.hasCostData
      ? `Gross profit: ${formatVnd(p.grossProfit)}; margin ${p.grossMarginPct?.toFixed(1) ?? '—'}%`
      : 'Chưa có giá vốn SP'
  }
  return ''
}

function sellerGreet(userName?: string): string {
  const n = userName?.trim()
  if (!n || n.length < 2 || /guest|khach/i.test(n)) return ''
  return `${n.split(/\s+/).pop()}, `
}

/** Route seller intent → analytics presentation when applicable. */
export function buildSellerAnalyticsReply(
  ctx: ChatContext,
  intent: ChatIntent,
  raw: string,
  prior?: Partial<SellerAnalyticsSpec>,
): string | null {
  const catalog = ctx.sellerProducts.length ? ctx.sellerProducts : ctx.products
  const spec = parseSellerBusinessQuery(raw, intent, prior)

  if (intent === 'seller_dss_explain' || spec.metric === 'dss_explain') {
    return presentDssExplain()
  }

  if (intent === 'seller_business_health' || spec.metric === 'health') {
    return presentBusinessHealthReply(buildBusinessHealth(ctx, catalog), ctx.userName)
  }

  if (intent === 'seller_profit' || spec.metric === 'profit') {
    return presentProfitReply(computeProfitSnapshot(catalog, ctx.salesPerformance), ctx.userName)
  }

  if (
    (intent === 'seller_revenue' || spec.metric === 'revenue') &&
    ctx.salesPerformance
  ) {
    return presentRevenueReply(ctx.salesPerformance, spec, ctx.userName)
  }

  if (spec.metric === 'restock' || (intent === 'seller_inventory' && /nhap|restock|nen nhap/.test(normalizeText(raw)))) {
    return presentRestockReply(ctx.sellerDashboard, catalog, ctx.userName)
  }

  if (
    (intent === 'seller_orders' || intent === 'seller_recent_orders' || spec.metric === 'orders') &&
    /hom nay|hom qua|thang nay|gan day|dang giao|bao nhieu don/.test(normalizeText(raw))
  ) {
    const orders = ctx.orders.length ? ctx.orders : ctx.sellerDashboard?.recentOrders?.map(sellerOrderToOrder) ?? []
    if (orders.length) {
      return presentSellerOrdersReply(orders, raw, undefined, ctx.userName)
    }
  }

  return null
}

function sellerOrderToOrder(o: {
  orderId: string
  customer: string
  total: number
  status: string
  createdAt?: string
}): Order {
  return {
    id: String(o.orderId),
    customerId: '',
    customerName: o.customer,
    items: [],
    total: o.total,
    status: mapSellerOrderStatus(o.status),
    shippingAddress: '',
    createdAt: o.createdAt ?? new Date().toISOString(),
    updatedAt: o.createdAt ?? new Date().toISOString(),
  }
}

function mapSellerOrderStatus(s: string): Order['status'] {
  const n = normalizeText(s)
  if (/delivered|da giao/.test(n)) return 'delivered'
  if (/shipping|dang giao/.test(n)) return 'shipping'
  if (/cancel|huy/.test(n)) return 'cancelled'
  if (/confirm/.test(n)) return 'confirmed'
  return 'pending'
}
