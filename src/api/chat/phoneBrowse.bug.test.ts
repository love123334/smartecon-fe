import { describe, expect, it, vi } from 'vitest'
import { detectIntent } from '@/api/chat/intents'
import { prepareCatalogSearchQuery, toEnglishProcessingText } from '@/api/chat/chatLocale'
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
    rating: 4.5,
    soldCount: 20,
    createdAt: '2026-01-01',
    shopName: 'NT Tech',
    ...partial,
  }
}

describe('phone browse bug', () => {
  const q = 'có điện thoại gì xịn'
  const phones = [
    p({ id: '1', name: 'Điện thoại Samsung Galaxy S24', price: 24_990_000, category: 'Điện tử' }),
    p({ id: '2', name: 'Điện thoại iPhone 15 Pro 128GB', price: 29_990_000, category: 'Điện thoại' }),
  ]

  it('cleans slang so API LIKE can match', () => {
    expect(prepareCatalogSearchQuery(q)).toBe('dien thoai')
    expect(toEnglishProcessingText(q)).toMatch(/dien thoai/i)
    expect(detectIntent(q, 'customer')?.intent).toMatch(/product_search|category_browse|recommend/)
  })

  it('finds phones in Điện tử category', () => {
    expect(findProductsByQuery(phones, q).length).toBeGreaterThan(0)
  })

  it('reply includes phones for slang browse', async () => {
    const ctx = {
      role: 'customer',
      userName: 'Test',
      products: phones,
      orders: [],
      purchaseOrders: [],
      cartLines: [],
      cartTotal: 0,
      cartItemCount: 0,
      categories: [
        { id: '1', name: 'Điện thoại', slug: 'dien-thoai', productCount: 1 },
        { id: '2', name: 'Điện tử', slug: 'dien-tu', productCount: 1 },
      ],
      sellerProducts: [],
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
    } as ChatContext
    const reply = await resolveChatReply(q, [], ctx)
    expect(reply.products?.length ?? 0).toBeGreaterThan(0)
    expect(reply.content).not.toMatch(/chưa thấy|chưa tìm thấy|không có sản phẩm điện thoại/i)
  })

  it('keeps only phones under 20 triệu and explains the pick', async () => {
    const catalog = [
      p({ id: '1', name: 'Điện thoại iPhone 15 Pro 128GB', price: 29_990_000, category: 'Điện thoại' }),
      p({
        id: '2',
        name: 'Điện thoại Xiaomi 14',
        price: 17_990_000,
        category: 'Điện thoại',
        rating: 4.7,
        soldCount: 90,
        description: 'Camera Leica, pin khỏe dùng cả ngày',
      }),
      p({ id: '3', name: 'Điện thoại Galaxy S24', price: 24_990_000, category: 'Điện thoại' }),
    ]
    const ctx = {
      role: 'customer',
      userName: 'Test',
      products: catalog,
      orders: [],
      purchaseOrders: [],
      cartLines: [],
      cartTotal: 0,
      cartItemCount: 0,
      categories: [{ id: '1', name: 'Điện thoại', slug: 'dien-thoai', productCount: 3 }],
      sellerProducts: [],
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
    } as ChatContext
    const reply = await resolveChatReply('có điện thoại gì dưới 20 triệu không', [], ctx)
    expect(reply.products?.length).toBeGreaterThan(0)
    expect(reply.products?.every((x) => x.price <= 20_000_000)).toBe(true)
    expect(reply.products?.some((x) => /iphone 15 pro/i.test(x.name))).toBe(false)
    expect(reply.content).toMatch(/17[.,]990|Xiaomi/i)
    expect(reply.content).toMatch(/•/)
    expect(reply.content).not.toMatch(/iPhone 15 Pro/i)
  })
})
