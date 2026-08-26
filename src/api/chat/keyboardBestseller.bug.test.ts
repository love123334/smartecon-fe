import { describe, expect, it, vi } from 'vitest'
import { detectIntent } from '@/api/chat/intents'
import { prepareCatalogSearchQuery } from '@/api/chat/chatLocale'
import { findProductsByQuery } from '@/api/chat/products'
import { resolveChatReply } from '@/api/chat/responder'
import type { ChatContext } from '@/api/chat/context'
import type { Product } from '@/types'

vi.mock('@/api/chat/llm', () => ({
  isLlmConfigured: () => false,
  callChatLlm: vi.fn(),
  llmProviderLabel: () => 'mock',
  refreshBeAiStatus: vi.fn(),
}))

function p(partial: Partial<Product> & Pick<Product, 'id' | 'name' | 'price' | 'category'>): Product {
  return {
    description: '',
    stock: 10,
    imageUrl: '/x.jpg',
    sellerId: 's1',
    rating: 4.7,
    soldCount: 20,
    createdAt: '2026-01-01',
    shopName: 'SEDSP Official',
    ...partial,
  }
}

const KEYBOARD_Q = 'Có bàn phím cơ RGB nào đang bán chạy?'

describe('keyboard bestseller chip must not dump DSS fryer/shoes', () => {
  const catalog = [
    p({
      id: 'kb',
      name: 'Bàn phím cơ RGB KeyPro K87',
      price: 2_450_000,
      category: 'Điện tử',
      soldCount: 210,
    }),
    p({
      id: 'fryer',
      name: 'Nồi chiên không dầu 5L',
      price: 1_290_000,
      category: 'Gia dụng',
      soldCount: 1086,
    }),
    p({
      id: 'shoes',
      name: 'Giày chạy bộ AirFlex Marathon',
      price: 1_490_000,
      category: 'Thể thao',
      soldCount: 1064,
    }),
  ]

  it('strips bán chạy so "chay" does not match running shoes', () => {
    const cleaned = prepareCatalogSearchQuery(KEYBOARD_Q)
    expect(cleaned).toMatch(/ban phim/)
    expect(cleaned).not.toMatch(/\bchay\b/)
  })

  it('classifies as product search, not generic DSS recommend', () => {
    expect(detectIntent(KEYBOARD_Q, 'customer')?.intent).toBe('product_search')
  })

  it('finds the keyboard instead of fryer/shoes', () => {
    const hits = findProductsByQuery(catalog, KEYBOARD_Q)
    expect(hits.some((x) => x.id === 'kb')).toBe(true)
    expect(hits.every((x) => x.id !== 'fryer' && x.id !== 'shoes')).toBe(true)
  })

  it('local reply talks about the keyboard even when DSS recs are fryer/shoes', async () => {
    const ctx = {
      role: 'customer',
      userName: 'Test',
      products: catalog,
      orders: [],
      purchaseOrders: [],
      cartLines: [],
      cartTotal: 0,
      cartItemCount: 0,
      categories: [
        { id: '1', name: 'Điện tử', slug: 'dien-tu', productCount: 1 },
        { id: '2', name: 'Gia dụng', slug: 'gia-dung', productCount: 1 },
        { id: '3', name: 'Thể thao', slug: 'the-thao', productCount: 1 },
      ],
      sellerProducts: [],
      sellerInsights: [],
      managerInsights: [],
      categoryChart: [],
      users: [],
      systemMetrics: [],
      recommendations: [
        {
          productId: 'fryer',
          score: 0.92,
          reason: 'Bán chạy',
          reasons: ['Bán chạy (đã bán 1086)'],
        },
        {
          productId: 'shoes',
          score: 0.92,
          reason: 'Bán chạy',
          reasons: ['Bán chạy (đã bán 1064)'],
        },
      ],
      publicVouchers: [],
      dataSource: 'api',
      backendOnline: true,
      catalogSource: 'backend',
    } as ChatContext

    const reply = await resolveChatReply(KEYBOARD_Q, [], ctx)
    expect(reply.content).toMatch(/bàn phím/i)
    expect(reply.content).not.toMatch(/nồi chiên|giày chạy/i)
    expect(reply.products?.some((x) => /bàn phím/i.test(x.name))).toBe(true)
    expect(reply.products?.every((x) => !/nồi chiên|giày chạy/i.test(x.name))).toBe(true)
  })
})
