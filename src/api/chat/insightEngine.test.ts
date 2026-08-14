import { describe, expect, it } from 'vitest'
import type { ChatContext } from '@/api/chat/context'
import {
  buildCatalogInsight,
  buildRecommendInsight,
  deriveStateFromTurn,
  formatCatalogInsightReply,
} from '@/api/chat/insightEngine'

function minimalCtx(): ChatContext {
  return {
    role: 'customer',
    products: [
      {
        id: '1',
        name: 'SSD Samsung T7 1TB',
        description: 'Portable SSD',
        price: 3_490_000,
        stock: 48,
        category: 'Phụ kiện',
        imageUrl: '/ssd.jpg',
        sellerId: 's1',
        shopName: 'Tech',
        rating: 5,
        soldCount: 180,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '2',
        name: 'Samsung Galaxy S24',
        description: 'Flagship phone',
        price: 24_990_000,
        stock: 20,
        category: 'Điện thoại',
        imageUrl: '/s24.jpg',
        sellerId: 's2',
        shopName: 'Mobile',
        rating: 4.5,
        soldCount: 120,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '3',
        name: 'Dell XPS 15',
        description: 'Premium laptop',
        price: 38_990_000,
        stock: 8,
        category: 'Laptop',
        imageUrl: '/xps.jpg',
        sellerId: 's3',
        shopName: 'PC Hub',
        rating: 4.5,
        soldCount: 95,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    orders: [],
    purchaseOrders: [],
    cartLines: [],
    cartTotal: 0,
    cartItemCount: 0,
    categories: [
      { id: 'c1', name: 'Điện thoại', slug: 'dien-thoai', productCount: 1 },
      { id: 'c2', name: 'Laptop', slug: 'laptop', productCount: 1 },
      { id: 'c3', name: 'Phụ kiện', slug: 'phu-kien', productCount: 1 },
    ],
    sellerProducts: [],
    sellerInsights: [],
    managerInsights: [],
    categoryChart: [],
    users: [],
    systemMetrics: [],
    recommendations: [],
    publicVouchers: [],
    dataSource: 'mock',
    backendOnline: true,
    catalogSource: 'mock',
  }
}

describe('insightEngine', () => {
  it('builds catalog insight with opinions not category dump', () => {
    const bundle = buildCatalogInsight(minimalCtx())
    const reply = formatCatalogInsightReply(minimalCtx(), bundle)
    expect(reply).toMatch(/sản phẩm|danh mục/i)
    expect(reply).not.toMatch(/Danh mục nổi bật/i)
    expect(reply).not.toMatch(/\(.* SP\)/)
    expect(bundle.productInsights.length).toBeGreaterThan(0)
    expect(bundle.highlightProducts.length).toBeGreaterThan(0)
  })

  it('detects value product in recommend insight', () => {
    const ctx = minimalCtx()
    const bundle = buildRecommendInsight(ctx, ctx.products)
    const text = bundle.paragraphs.join(' ')
    expect(text).toMatch(/SSD|T7|value|rating|5/i)
  })

  it('derives conversation state from budget laptop query', () => {
    const state = deriveStateFromTurn(
      'Tui cần laptop tầm 30 triệu',
      'product_budget',
      minimalCtx().categories,
    )
    expect(state.topic).toBe('product_recommendation')
    expect(state.budget).toBeGreaterThan(0)
    expect(state.userGoal).toMatch(/buy_|budget/)
  })
})
