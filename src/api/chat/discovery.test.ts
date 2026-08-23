import { describe, expect, it, vi } from 'vitest'
import { asksProductDiscovery, isAmbiguousShoppingQuery, isStandaloneShoppingQuery, isUnknownEscalateText } from '@/api/chat/discovery'
import { detectIntent } from '@/api/chat/intents'
import { normalizeText } from '@/api/chat/match'
import { resolveChatReply } from '@/api/chat/responder'
import { escalateReply } from '@/api/chat/responses'
import type { ChatContext } from '@/api/chat/context'
import type { ChatMessage } from '@/types'

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

  it('detects informal browse slang including xịn', () => {
    expect(asksProductDiscovery('có gì xịn')).toBe(true)
    expect(asksProductDiscovery('co gi xin')).toBe(true)
    expect(asksProductDiscovery('có gì hay')).toBe(true)
    expect(asksProductDiscovery('co gi ngonn')).toBe(true)
    expect(detectIntent('có gì xịn', 'customer')?.intent).toBe('recommend')
  })

  it('treats only bare "có gì" as ambiguous in-domain', () => {
    expect(isAmbiguousShoppingQuery('có gì')).toBe(true)
    expect(isAmbiguousShoppingQuery('có gì hay')).toBe(false)
    expect(asksProductDiscovery('có gì hay')).toBe(true)
  })

  it('answers discovery with natural intro and products, not off-topic', async () => {
    const reply = await resolveChatReply('có món gì mới không', [], minimalCtx())
    expect(reply.content).toMatch(/món mới|đáng xem|gợi ý/i)
    expect(reply.content).not.toMatch(/chưa hiểu rõ câu hỏi/i)
    expect(reply.products?.length).toBeGreaterThan(0)
    expect(reply.content).not.toBe(escalateReply(minimalCtx(), '', 'unknown'))
  })

  it('answers informal browse with products, not off-topic', async () => {
    const reply = await resolveChatReply('có gì xịn', [], minimalCtx())
    expect(reply.content).not.toMatch(/chưa hiểu rõ câu hỏi/i)
    expect(reply.content).toMatch(/gợi ý|đáng xem|gom/i)
    expect(reply.products?.length ?? 0).toBeGreaterThan(0)
  })

  it('answers "có gì hay" as discovery recommend', async () => {
    const reply = await resolveChatReply('có gì hay', [], minimalCtx())
    expect(reply.content).not.toMatch(/chưa hiểu rõ câu hỏi/i)
    expect(reply.products?.length ?? 0).toBeGreaterThan(0)
  })

  it('clarifies bare "có gì" without random product card', async () => {
    const reply = await resolveChatReply('có gì', [], minimalCtx())
    expect(reply.content).toMatch(/sản phẩm mới|deal|đánh giá cao/i)
    expect(reply.products?.length ?? 0).toBe(0)
  })

  it('flags unknown escalate text for reconciliation', () => {
    expect(isUnknownEscalateText(escalateReply(minimalCtx(), '', 'unknown'))).toBe(true)
  })

  it('detects standalone browse queries like "có tai nghe gì"', () => {
    expect(isStandaloneShoppingQuery('có tai nghe gì')).toBe(true)
    expect(detectIntent('có tai nghe gì', 'customer')?.intent).toBe('product_search')
  })

  it('answers web ban gi with catalog overview not fashion skirts', async () => {
    const reply = await resolveChatReply('Web bán gì vậy?', [], minimalCtx())
    expect(reply.content).toMatch(/SEDSP|sản phẩm|danh mục|shop/i)
    expect(reply.content).not.toMatch(/web ban vay/i)
    expect(reply.content).not.toMatch(/Danh mục nổi bật/i)
    expect(reply.content).not.toMatch(/\(.* SP\)/)
    expect(reply.products?.length ?? 0).toBeGreaterThan(0)
  })

  it('does not echo internal search key for category chip "Điện thoại có gì?"', async () => {
    const phone = {
      id: 'ph-1',
      name: 'Điện thoại Samsung Galaxy A55',
      description: 'Smartphone Android',
      price: 9_990_000,
      stock: 20,
      category: 'Điện thoại',
      imageUrl: '/ph.jpg',
      sellerId: 's1',
      shopName: 'Mobile Hub',
      rating: 4.5,
      soldCount: 120,
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const reply = await resolveChatReply('Điện thoại có gì?', [], {
      ...minimalCtx(),
      products: [phone],
    })
    expect(reply.content).not.toMatch(/dien thoai co/i)
    expect(reply.content).toMatch(/lựa chọn|nghiêng về|ổn|điện thoại/i)
    expect(reply.products?.length ?? 0).toBeGreaterThan(0)
  })

  it('answers "có tai nghe gì" with headphones, not unknown + random SSD', async () => {
    const headphone = {
      id: 'hp-1',
      name: 'Tai nghe Bluetooth Pro ANC',
      description: 'Tai nghe chống ồn',
      price: 1_890_000,
      stock: 45,
      category: 'Điện tử',
      imageUrl: '/hp.jpg',
      sellerId: 's1',
      shopName: 'NT Tech',
      rating: 4.6,
      soldCount: 200,
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const ssd = {
      id: 'ssd-1',
      name: 'Ổ cứng SSD Samsung T7 1TB',
      description: 'SSD portable',
      price: 3_490_000,
      stock: 10,
      category: 'Phụ kiện',
      imageUrl: '/ssd.jpg',
      sellerId: 's2',
      shopName: 'Electronics',
      rating: 4.8,
      soldCount: 80,
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const ctx: ChatContext = {
      ...minimalCtx(),
      products: [headphone, ssd],
    }
    const history: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'SSD info',
        timestamp: '',
        products: [{ id: 'ssd-1', name: ssd.name, price: ssd.price, imageUrl: ssd.imageUrl, category: ssd.category }],
      },
    ]
    const reply = await resolveChatReply('Có tai nghe gì?', history, ctx)
    expect(reply.content).not.toMatch(/chưa hiểu rõ câu hỏi/i)
    expect(reply.products?.some((p) => /tai nghe/i.test(p.name))).toBe(true)
    expect(reply.products?.some((p) => /ssd/i.test(p.name))).toBe(false)
  })
})
