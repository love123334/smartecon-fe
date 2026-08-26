import { describe, expect, it, vi } from 'vitest'
import { detectIntent, isVoucherQuery } from '@/api/chat/intents'
import { routeFromIntent } from '@/api/chat/intentRouter'
import { resolveChatReply } from '@/api/chat/responder'
import type { ChatContext } from '@/api/chat/context'
import type { Product } from '@/types'
import type { Voucher } from '@/api/real/vouchers'

vi.mock('@/api/chat/llm', () => ({
  isLlmConfigured: () => false,
  callChatLlm: vi.fn(),
  llmProviderLabel: () => 'mock',
  refreshBeAiStatus: vi.fn(),
}))

const VOUCHER_Q = 'Có mã voucher giảm giá nào đang áp dụng được không?'

function p(partial: Partial<Product> & Pick<Product, 'id' | 'name' | 'price' | 'category'>): Product {
  return {
    description: 'Đèn trang trí phòng khách',
    stock: 10,
    imageUrl: '/lamp.jpg',
    sellerId: 's1',
    rating: 4,
    soldCount: 220,
    createdAt: '2026-01-01',
    shopName: 'Home Decor',
    ...partial,
  }
}

const sampleVoucher: Voucher = {
  id: 1,
  code: 'SEDSP10',
  name: 'Giảm 10% toàn sàn',
  description: 'Giảm 10% cho đơn từ 200k',
  discountType: 'PERCENTAGE',
  discountValue: 10,
  scope: 'PLATFORM',
  sellerId: null,
  sellerName: null,
  appliesTo: 'ALL_PRODUCTS',
  minimumOrderAmount: 200_000,
  maximumDiscountAmount: 50_000,
  usageLimit: null,
  usedCount: 3,
  startsAt: '2026-01-01T00:00:00Z',
  endsAt: '2026-12-31T00:00:00Z',
  isActive: true,
  productIds: [],
  requestId: null,
  createdAt: '2026-01-01T00:00:00Z',
}

function ctx(vouchers: Voucher[], products: Product[] = []): ChatContext {
  return {
    role: 'customer',
    userName: 'Test',
    products,
    orders: [],
    purchaseOrders: [],
    cartLines: [],
    cartTotal: 0,
    cartItemCount: 0,
    categories: [{ id: '1', name: 'Trang trí', slug: 'trang-tri', productCount: 1 }],
    sellerProducts: [],
    sellerInsights: [],
    managerInsights: [],
    categoryChart: [],
    users: [],
    systemMetrics: [],
    recommendations: [],
    publicVouchers: vouchers,
    dataSource: 'api',
    backendOnline: true,
    catalogSource: 'backend',
  } as ChatContext
}

describe('voucher query must not become a product rec', () => {
  it('detects the homepage chip as promo', () => {
    expect(isVoucherQuery(VOUCHER_Q)).toBe(true)
    expect(detectIntent(VOUCHER_Q, 'customer')?.intent).toBe('promo')
    expect(routeFromIntent('promo')).toBe('ORDERS_CART')
  })

  it('lists voucher codes instead of recommending a SKU', async () => {
    const catalog = [
      p({
        id: '99',
        name: 'Đèn đứng LED trang trí',
        price: 1_299_000,
        category: 'Trang trí',
      }),
    ]
    const reply = await resolveChatReply(VOUCHER_Q, [], ctx([sampleVoucher], catalog))
    expect(reply.content).toMatch(/SEDSP10/)
    expect(reply.content).toMatch(/voucher|mã/i)
    expect(reply.content).not.toMatch(/Đèn đứng|nghiêng/i)
    expect(reply.products?.length ?? 0).toBe(0)
  })

  it('says none when the public list is empty', async () => {
    const reply = await resolveChatReply(VOUCHER_Q, [], ctx([]))
    expect(reply.content).toMatch(/Chưa có voucher/i)
    expect(reply.content).not.toMatch(/Đèn đứng|nghiêng/i)
  })
})
