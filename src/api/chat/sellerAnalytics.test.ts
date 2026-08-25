import { describe, expect, it } from 'vitest'
import {
  buildBusinessHealth,
  buildRevenueComparison,
  computeProfitSnapshot,
  parseSellerBusinessQuery,
  presentBusinessHealthReply,
  presentDssExplain,
  presentRevenueReply,
} from '@/api/chat/sellerAnalytics'
import type { ChatContext } from '@/api/chat/context'
import type { Product } from '@/types'
import type { SalesPerformance } from '@/api/real/seller'

function product(partial: Partial<Product> & Pick<Product, 'id' | 'name' | 'price'>): Product {
  return {
    description: '',
    stock: 10,
    imageUrl: '',
    sellerId: 's1',
    category: 'Điện tử',
    rating: 4,
    soldCount: 20,
    createdAt: '2026-01-01',
    ...partial,
  }
}

const perf: SalesPerformance = {
  summary: { totalRevenue: 48_200_000, completedOrders: 37, averageOrderValue: 1_302_000 },
  monthlyRevenue: [
    { label: '2026-06', value: 38_000_000 },
    { label: '2026-07', value: 42_000_000 },
    { label: '2026-08', value: 48_200_000 },
  ],
  topProducts: [
    { productId: '1', productName: 'KeyPro K87', quantitySold: 12, revenue: 29_400_000 },
  ],
}

const baseCtx = (overrides?: Partial<ChatContext>): ChatContext =>
  ({
    role: 'seller',
    userName: 'Seller Demo',
    products: [],
    orders: [],
    purchaseOrders: [],
    cartLines: [],
    cartTotal: 0,
    cartItemCount: 0,
    categories: [],
    sellerProducts: [
      product({ id: '1', name: 'KeyPro K87', price: 2_450_000, costPrice: 1_800_000, soldCount: 12, stock: 6 }),
    ],
    sellerDashboard: {
      revenue: { totalRevenue: 48_200_000, completedOrders: 37 },
      orders: { pending: 2, processing: 1, shipping: 3, delivered: 31 },
      products: { totalProducts: 5, activeProducts: 5 },
      inventory: { lowStockCount: 1, outOfStockCount: 0 },
      lowStockProducts: [{ productId: '1', productName: 'KeyPro K87', quantity: 6 }],
      recommendations: [],
      recentReviews: [],
      recentOrders: [],
    },
    salesPerformance: perf,
    sellerInsights: [],
    managerInsights: [],
    categoryChart: [],
    users: [],
    systemMetrics: [],
    recommendations: [],
    publicVouchers: [],
    dataSource: 'api',
    backendOnline: true,
    catalogSource: 'backend',
    ...overrides,
  }) as ChatContext

describe('parseSellerBusinessQuery', () => {
  it('detects business health intent', () => {
    const spec = parseSellerBusinessQuery('shop tôi dạo này sao rồi?', 'seller_business_health')
    expect(spec.metric).toBe('health')
  })

  it('detects revenue comparison', () => {
    const spec = parseSellerBusinessQuery('doanh thu tháng này tăng hay giảm?', 'seller_revenue')
    expect(spec.metric).toBe('revenue')
    expect(spec.comparePrevious).toBe(true)
  })

  it('parses numbered calendar month instead of last month with data', () => {
    const spec = parseSellerBusinessQuery('doanh thu tháng 8', 'seller_revenue', undefined, new Date(2026, 7, 25))
    expect(spec.period).toBe('calendar_month')
    expect(spec.calendarMonth).toEqual({ year: 2026, month: 8 })
  })

  it('parses Vietnamese month name tháng tám', () => {
    const spec = parseSellerBusinessQuery('doanh thu tháng tám', 'seller_revenue', undefined, new Date(2026, 7, 25))
    expect(spec.calendarMonth).toEqual({ year: 2026, month: 8 })
  })

  it('keeps prior metric on follow-up', () => {
    const prior = parseSellerBusinessQuery('doanh thu tháng này?', 'seller_revenue')
    const follow = parseSellerBusinessQuery('tại sao tăng?', null, prior)
    expect(follow.metric).toBe('revenue')
    expect(follow.detailLevel).toBe('comparison')
  })
})

describe('buildRevenueComparison', () => {
  it('computes month-over-month change', () => {
    const cmp = buildRevenueComparison(perf, undefined, new Date(2026, 7, 25))
    expect(cmp?.trend).toBe('up')
    expect(cmp?.changePct).toBeGreaterThan(0)
  })

  it('does not substitute another month when the asked month is empty', () => {
    const juneOnly: SalesPerformance = {
      ...perf,
      monthlyRevenue: [
        { label: '2026-06', value: 38_000_000 },
      ],
    }
    const spec = parseSellerBusinessQuery('doanh thu tháng 8', 'seller_revenue', undefined, new Date(2026, 7, 25))
    const cmp = buildRevenueComparison(juneOnly, spec, new Date(2026, 7, 25))
    expect(cmp?.current.missing).toBe(true)
    expect(cmp?.current.revenue).toBe(0)
    expect(cmp?.current.label).toMatch(/8/)
  })
})

describe('presentRevenueReply', () => {
  it('summarizes with comparison not raw dump', () => {
    const spec = parseSellerBusinessQuery('doanh thu tháng này so với tháng trước', 'seller_revenue')
    const reply = presentRevenueReply(perf, spec)
    expect(reply).toMatch(/tăng/i)
    expect(reply).toMatch(/KeyPro K87/)
    expect(reply).not.toMatch(/createdAt|updatedAt/)
  })

  it('says August is empty instead of answering with June', () => {
    const juneOnly: SalesPerformance = {
      ...perf,
      monthlyRevenue: [{ label: '2026-06', value: 38_000_000 }],
    }
    const spec = parseSellerBusinessQuery('doanh thu tháng 8', 'seller_revenue', undefined, new Date(2026, 7, 25))
    const reply = presentRevenueReply(juneOnly, spec)
    expect(reply).toMatch(/tháng 8/i)
    expect(reply).toMatch(/Chưa có doanh thu/)
    expect(reply).toMatch(/2026-06/)
    expect(reply).not.toMatch(/tháng này.*38/)
  })
})

describe('computeProfitSnapshot', () => {
  it('requires cost data for profit', () => {
    const noCost = computeProfitSnapshot([product({ id: '2', name: 'Mouse X', price: 500_000, soldCount: 5 })])
    expect(noCost.hasCostData).toBe(false)

    const withCost = computeProfitSnapshot(baseCtx().sellerProducts, perf)
    expect(withCost.hasCostData).toBe(true)
    expect(withCost.grossProfit).toBeGreaterThan(0)
  })
})

describe('buildBusinessHealth', () => {
  it('returns evidence-based health report', () => {
    const report = buildBusinessHealth(baseCtx(), baseCtx().sellerProducts)
    expect(report.statusLabel).toBeTruthy()
    expect(report.positives.length + report.risks.length).toBeGreaterThan(0)
    const reply = presentBusinessHealthReply(report)
    expect(reply).toMatch(/shop/i)
    expect(reply).not.toMatch(/marketing nhiều hơn/i)
  })
})

describe('presentDssExplain', () => {
  it('lists implemented DSS features only', () => {
    const text = presentDssExplain()
    expect(text).toMatch(/Dự báo nhu cầu/)
    expect(text).toMatch(/What-if/)
    expect(text).not.toMatch(/blockchain/i)
  })
})
