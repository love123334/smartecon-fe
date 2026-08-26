import { describe, expect, it, vi } from 'vitest'
import { resolveChatReply } from '@/api/chat/responder'
import type { ChatContext } from '@/api/chat/context'
import type { Product } from '@/types'

const { callChatLlm } = vi.hoisted(() => ({
  callChatLlm: vi.fn(async () =>
    'Tai nghe Sony WH-1000XM5 đang bán 7.990.000đ, chống ồn tốt và còn 8 cái.',
  ),
}))

vi.mock('@/api/chat/llm', () => ({
  isLlmConfigured: () => true,
  callChatLlm,
  llmProviderLabel: () => 'mock',
  refreshBeAiStatus: vi.fn(),
}))

vi.mock('@/api/chat/enrich', () => ({
  enrichChatContext: async (ctx: ChatContext) => ctx,
  enrichFocusProduct: async () => ({}),
}))

function p(partial: Partial<Product> & Pick<Product, 'id' | 'name' | 'price' | 'category'>): Product {
  return {
    description: '',
    stock: 8,
    imageUrl: '/x.jpg',
    sellerId: 's1',
    rating: 4.8,
    soldCount: 120,
    createdAt: '2026-01-01',
    shopName: 'NT Tech',
    ...partial,
  }
}

function ctx(): ChatContext {
  return {
    role: 'customer',
    userName: 'Test',
    products: [p({ id: '1', name: 'Tai nghe Sony WH-1000XM5', price: 7_990_000, category: 'Âm thanh' })],
    orders: [],
    purchaseOrders: [],
    cartLines: [],
    cartTotal: 0,
    cartItemCount: 0,
    categories: [{ id: '1', name: 'Âm thanh', slug: 'am-thanh', productCount: 1 }],
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
}

describe('chatbot speed routing', () => {
  it('greeting does not wait for LLM', async () => {
    callChatLlm.mockClear()
    const reply = await resolveChatReply('xin chào', [], ctx())
    expect(callChatLlm).not.toHaveBeenCalled()
    expect(reply.source).toBe('local')
    expect(reply.content.length).toBeGreaterThan(4)
  })

  it('shopping questions wait for LLM wording instead of a local template', async () => {
    callChatLlm.mockClear()
    const reply = await resolveChatReply('có tai nghe sony không', [], ctx())
    expect(callChatLlm).toHaveBeenCalled()
    expect(reply.source).toBe('llm')
    expect(reply.content).toMatch(/Sony WH-1000XM5/)
    expect(reply.content).not.toMatch(/^•/)
  })

  it('keyboard bestseller chip still waits for LLM', async () => {
    callChatLlm.mockClear()
    const reply = await resolveChatReply('Có bàn phím cơ RGB nào đang bán chạy?', [], ctx())
    expect(callChatLlm).toHaveBeenCalled()
    expect(reply.source).toBe('llm')
  })
})
