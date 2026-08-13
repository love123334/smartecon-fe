import { describe, expect, it, vi } from 'vitest'
import { asksProductDiscovery, isAmbiguousShoppingQuery, isUnknownEscalateText } from '@/api/chat/discovery'
import { detectIntent } from '@/api/chat/intents'
import { normalizeText } from '@/api/chat/match'
import { resolveChatReply } from '@/api/chat/responder'
import { escalateReply } from '@/api/chat/responses'
import type { ChatContext } from '@/api/chat/context'

vi.mock('@/api/chat/llm', () => ({
  isLlmConfigured: () => false,
  callChatLlm: vi.fn(),
  llmProviderLabel: () => 'mock',
  refreshBeAiStatus: vi.fn(),
}))

const skirtProduct = {
  id: 'p-new',
  name: 'Women Office Skirt',
  description: 'New arrival',
  price: 699_000,
  stock: 10,
  category: 'Thời trang',
  imageUrl: '/skirt.jpg',
  sellerId: 's1',
  shopName: 'Fashion Hub',
  rating: 4.5,
  soldCount: 120,
  createdAt: '2026-08-10T00:00:00.000Z',
}

const keyboardProduct = {
  id: 'p-old',
  name: 'Old Keyboard',
  description: '',
  price: 1_000_000,
  stock: 5,
  category: 'Điện tử',
  imageUrl: '/kb.jpg',
  sellerId: 's2',
  shopName: 'Tech',
  rating: 4,
  soldCount: 50,
  createdAt: '2025-01-01T00:00:00.000Z',
}

function minimalCtx(): ChatContext {
  return {
    role: 'customer',
    userName: 'Test',
    products: [skirtProduct, keyboardProduct],
    sellerProducts: [],
    categories: [],
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
  }
}

describe('product discovery', () => {
  it('detects "có món gì mới không" as recommend, not unknown', () => {
    const q = normalizeText('có món gì mới không')
    expect(asksProductDiscovery(q)).toBe(true)
    expect(detectIntent('có món gì mới không', 'customer')?.intent).toBe('recommend')
  })

  it('detects discovery variants', () => {
    expect(asksProductDiscovery(normalizeText('giới thiệu tôi vài món'))).toBe(true)
    expect(asksProductDiscovery(normalizeText('có gì đáng mua không'))).toBe(true)
  })

  it('treats vague "có gì hay" as ambiguous in-domain', () => {
    expect(isAmbiguousShoppingQuery(normalizeText('có gì hay'))).toBe(true)
    expect(asksProductDiscovery(normalizeText('có gì hay'))).toBe(false)
  })

  it('answers discovery with natural intro and products, not off-topic', async () => {
    const reply = await resolveChatReply('có món gì mới không', [], minimalCtx())
    expect(reply.content).toMatch(/món mới|đáng xem|gợi ý/i)
    expect(reply.content).not.toMatch(/chưa hiểu rõ câu hỏi/i)
    expect(reply.products?.length).toBeGreaterThan(0)
    expect(reply.content).not.toBe(escalateReply(minimalCtx(), '', 'unknown'))
  })

  it('clarifies ambiguous query without random product card', async () => {
    const reply = await resolveChatReply('có gì hay', [], minimalCtx())
    expect(reply.content).toMatch(/sản phẩm mới|deal|đánh giá cao/i)
    expect(reply.products?.length ?? 0).toBe(0)
  })

  it('flags unknown escalate text for reconciliation', () => {
    expect(isUnknownEscalateText(escalateReply(minimalCtx(), '', 'unknown'))).toBe(true)
  })
})
