import { describe, expect, it } from 'vitest'
import { generateAssistantReply } from '@/api/chat/engine'
import { enrichChatContext } from '@/api/chat/enrich'
import { filterProductsByCategory } from '@/api/chat/products'
import { matchCategoryFromText, stripCategoryBrowseQuery } from '@/api/chat/synonyms'
import type { ChatContext } from '@/api/chat/context'
import type { Product } from '@/types'

const categories = [
  { id: 'c1', name: 'Gia dụng', slug: 'gia-dung', productCount: 2 },
  { id: 'c2', name: 'Nhà bếp', slug: 'kitchen', productCount: 1 },
  { id: 'c3', name: 'Nội thất', slug: 'furniture', productCount: 1 },
  { id: 'c4', name: 'Điện tử', slug: 'dien-tu', productCount: 3 },
]

const products: Product[] = [
  {
    id: 'k1',
    name: 'Ấm điện 1.8L',
    description: '',
    price: 499_000,
    stock: 10,
    category: 'Nhà bếp',
    imageUrl: '',
    sellerId: 's1',
    shopName: 'HomeStyle',
    rating: 4.2,
    soldCount: 20,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 's1',
    name: 'Sofa hiện đại',
    description: '',
    price: 15_990_000,
    stock: 2,
    category: 'Nội thất',
    imageUrl: '',
    sellerId: 's1',
    shopName: 'HomeStyle',
    rating: 4.1,
    soldCount: 5,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 't1',
    name: 'Bàn ăn gỗ',
    description: '',
    price: 10_990_000,
    stock: 4,
    category: 'Nội thất',
    imageUrl: '',
    sellerId: 's2',
    shopName: 'Nội Thất Việt',
    rating: 4.0,
    soldCount: 216,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

function minimalCtx(overrides: Partial<ChatContext> = {}): ChatContext {
  return {
    role: 'customer',
    userName: 'Test',
    products,
    sellerProducts: [],
    categories,
    orders: [],
    purchaseOrders: [],
    cartLines: [],
    cartItemCount: 0,
    cartTotal: 0,
    sellerInsights: [],
    managerInsights: [],
    categoryChart: [],
    users: [],
    systemMetrics: [],
    recommendations: [],
    publicVouchers: [],
    dataSource: 'mock',
    backendOnline: false,
    catalogSource: 'mock',
    ...overrides,
  }
}

describe('category browse matching', () => {
  it('strips co gi frame from category queries', () => {
    expect(stripCategoryBrowseQuery('Nội thất có gì?')).toBe('noi that')
    expect(stripCategoryBrowseQuery('Đồ gia dụng có gì vậy')).toBe('gia dung')
    expect(stripCategoryBrowseQuery('Gia dụng')).toBe('gia dung')
  })

  it('matches category names from browse phrases', () => {
    expect(matchCategoryFromText('Nội thất có gì?', categories)?.name).toBe('Nội thất')
    expect(matchCategoryFromText('Đồ gia dụng', categories)?.name).toBe('Gia dụng')
    expect(matchCategoryFromText('Gia dụng nhà bếp đang bán gì?', categories)?.name).toBe('Gia dụng')
  })

  it('filterProductsByCategory uses fuzzy category match', () => {
    const hits = filterProductsByCategory(products, 'Nội thất', categories)
    expect(hits.map((p) => p.name)).toEqual(['Sofa hiện đại', 'Bàn ăn gỗ'])
  })
})

describe('category browse reply', () => {
  it('returns product cards for category chip query', async () => {
    const ctx = minimalCtx()
    const enriched = await enrichChatContext(ctx, 'Nội thất có gì?', 'category_browse')
    const reply = await generateAssistantReply('Nội thất có gì?', enriched, undefined, 'category_browse')
    expect(reply.content.toLowerCase()).toMatch(/noi that|nội thất/)
    expect(reply.products?.length).toBeGreaterThan(0)
    expect(reply.products?.some((p) => /ban an|sofa/i.test(p.name))).toBe(true)
    expect(reply.sellers).toBeUndefined()
  })

  it('returns local category list for standalone category name', async () => {
    const ctx = minimalCtx({
      enrichment: {
        categoryProducts: products.filter((p) => p.category === 'Nội thất'),
      },
    })
    const reply = await generateAssistantReply('Gia dụng', ctx, undefined, 'category_browse')
    expect(reply.products?.length).toBeGreaterThan(0)
  })
})
