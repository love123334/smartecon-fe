import { describe, expect, it, vi } from 'vitest'
import {
  isContinuingProductChat,
  isProductFollowUp,
  lastDiscussedProducts,
  looksLikeOffTopicPlatformReply,
} from '@/api/chat/followup'
import { detectIntent } from '@/api/chat/intents'
import { normalizeText } from '@/api/chat/match'
import type { ChatContext } from '@/api/chat/context'
import { resolveChatReply } from '@/api/chat/responder'
import type { ChatMessage } from '@/types'

const { jeansProduct } = vi.hoisted(() => ({
  jeansProduct: {
    id: 'jeans-1',
    name: 'High Waist Jeans',
    description: 'Quần jean ống rộng',
    price: 899_000,
    stock: 12,
    category: 'Thời trang',
    imageUrl: '/jeans.jpg',
    sellerId: 's1',
    shopName: 'Fashion Hub',
    rating: 4.5,
    reviewCount: 8,
    soldCount: 42,
    createdAt: '2025-06-01T00:00:00.000Z',
    attributes: [{ name: 'Xuất xứ', value: 'Việt Nam' }],
  },
}))

vi.mock('@/api/chat/llm', () => ({
  isLlmConfigured: () => false,
  callChatLlm: vi.fn(),
  llmProviderLabel: () => 'mock',
  refreshBeAiStatus: vi.fn(),
}))

vi.mock('@/api/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/services')>()
  return {
    ...actual,
    reviewApi: {
      summary: vi.fn().mockResolvedValue({ averageRating: 4.5, totalReviews: 8 }),
      list: vi.fn().mockResolvedValue([
        {
          id: '1',
          userId: 'u1',
          userName: 'Lan',
          rating: 5,
          comment: 'Form đẹp, vải ổn, mặc đi làm rất hợp',
          createdAt: '2025-01-01',
        },
        {
          id: '2',
          userId: 'u2',
          userName: 'Minh',
          rating: 4,
          comment: 'Size chuẩn, giao nhanh',
          createdAt: '2025-01-02',
        },
      ]),
    },
    productApi: {
      ...actual.productApi,
      getById: vi.fn().mockResolvedValue(jeansProduct),
    },
  }
})
const jeansCard = {
  id: 'jeans-1',
  name: 'High Waist Jeans',
  price: 899_000,
  imageUrl: '/jeans.jpg',
  category: 'Thời trang',
  rating: 4.5,
  stock: 12,
}

function minimalCtx(): ChatContext {
  return {
    role: 'customer',
    userName: 'Khách',
    products: [jeansProduct],
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

describe('chat follow-up context', () => {
  it('maps "dùng làm gì" to product_info, not platform', () => {
    expect(detectIntent('dùng làm gì', 'customer')?.intent).toBe('product_info')
  })

  it('still maps SEDSP app questions to platform', () => {
    expect(detectIntent('SEDSP là gì', 'customer')?.intent).toBe('platform')
  })

  it('detects product attribute follow-ups', () => {
    expect(isProductFollowUp(normalizeText('dùng làm gì'))).toBe(true)
    expect(isProductFollowUp(normalizeText('còn hàng không'))).toBe(true)
    expect(isProductFollowUp(normalizeText('giá bao nhiêu'))).toBe(true)
    expect(isProductFollowUp(normalizeText('có món đồ gì hot'))).toBe(false)
  })

  it('continues short product chat when prior SP exists', () => {
    expect(isContinuingProductChat(normalizeText('thế nào'), true)).toBe(true)
    expect(isContinuingProductChat(normalizeText('đơn hàng của tôi'), true)).toBe(false)
  })

  it('flags platform boilerplate on product questions', () => {
    expect(
      looksLikeOffTopicPlatformReply(
        normalizeText('dùng làm gì'),
        'SEDSP — Smart E-Commerce Decision Support Platform: mua sắm (catalog VI ~55 SP), bán hàng, DSS (nhu cầu / giá / tồn / what-if) & AI hỗ trợ quyết định.',
      ),
    ).toBe(true)
  })

  it('reads last discussed product from history', () => {
    const history: ChatMessage[] = [
      {
        id: '1',
        role: 'user',
        content: 'AirPods',
        timestamp: '',
        attachments: [{ id: 'p1', name: 'AirPods Pro 2', price: 5990000, imageUrl: '' }],
      },
      {
        id: '2',
        role: 'assistant',
        content: 'AirPods Pro 2...',
        timestamp: '',
        products: [
          { id: 'p1', name: 'AirPods Pro 2', price: 5990000, imageUrl: '', category: 'Phụ kiện' },
        ],
      },
    ]
    expect(lastDiscussedProducts(history)[0]?.name).toBe('AirPods Pro 2')
  })

  it('answers review follow-up for prior product instead of price', async () => {
    const history: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'High Waist Jeans',
        timestamp: '',
        products: [jeansCard],
      },
    ]
    const reply = await resolveChatReply(
      'các khách khác đánh giá sản phẩm này sao',
      history,
      minimalCtx(),
    )
    expect(reply.content).toMatch(/đánh giá|4\.|review|K87|tích cực|mẫu/i)
    expect(reply.reviewSummary?.productName).toBe('High Waist Jeans')
    expect(reply.reviewSummary?.highlights.length).toBeGreaterThan(0)
    expect(reply.content).not.toMatch(/danh thiếp shop bên dưới/)
    expect(reply.content).not.toMatch(/đang bán\s+\*\*899/)
  })

  it('answers "khách thấy sao" with attached product card', async () => {
    const keyboard = {
      id: 'kb-1',
      name: 'Bàn phím cơ RGB KeyPro K87',
      price: 2_450_000,
      imageUrl: '/kb.jpg',
      category: 'Điện tử',
      rating: 4.2,
      stock: 5,
    }
    const reply = await resolveChatReply(
      'khách thấy sao',
      [],
      minimalCtx(),
      [keyboard],
    )
    expect(reply.content).toMatch(/đánh giá|4\.|review|K87|tích cực|mẫu/i)
    expect(reply.reviewSummary?.productName).toMatch(/KeyPro K87/)
    expect(reply.products?.[0]?.id).toBe('kb-1')
    expect(reply.content).not.toMatch(/Hỏi thêm: công dụng, giá, còn hàng/)
  })

  it('answers "người ta nghĩ seo" typo as review for attached keyboard', async () => {
    const keyboard = {
      id: 'kb-1',
      name: 'Bàn phím cơ RGB KeyPro K87',
      price: 2_450_000,
      imageUrl: '/kb.jpg',
      category: 'Điện tử',
      rating: 4.2,
      stock: 5,
    }
    const reply = await resolveChatReply(
      'người ta nghĩ seo',
      [],
      minimalCtx(),
      [keyboard],
    )
    expect(reply.reviewSummary?.productName).toMatch(/KeyPro K87/)
    expect(reply.content).toMatch(/mọi người|tóm tắt|đánh giá|chưa có đánh giá/i)
    expect(reply.content).not.toMatch(/Hỏi thêm: công dụng, giá, còn hàng/)
    expect(reply.content).not.toMatch(/Giá \*\*2\.450\.000/)
  })

  it('does not treat "đồ gia dụng" as follow-up on prior compare context', () => {
    expect(isContinuingProductChat(normalizeText('đồ gia dụng'), true)).toBe(false)
    expect(isContinuingProductChat(normalizeText('do gia dung'), true)).toBe(false)
  })

  it('switches topic to household goods instead of comparing prior products', async () => {
    const cleanser = {
      id: 'skin-1',
      name: 'Sữa rửa mặt Centella',
      price: 299_000,
      imageUrl: '/c.jpg',
      category: 'Chăm sóc da',
      rating: 5,
      stock: 79,
    }
    const crop = {
      id: 'top-1',
      name: 'Áo crop top basic',
      price: 299_000,
      imageUrl: '/t.jpg',
      category: 'Thời trang nữ',
      rating: 4,
      stock: 160,
    }
    const history: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'So sánh 2 SP',
        timestamp: '',
        products: [cleanser, crop],
      },
    ]
    const ctx: ChatContext = {
      ...minimalCtx(),
      products: [
        jeansProduct,
        {
          id: 'kettle-1',
          name: 'Ấm điện 1.8L',
          description: 'Ấm siêu tốc',
          price: 499_000,
          stock: 20,
          category: 'Nhà bếp',
          imageUrl: '/k.jpg',
          sellerId: 's3',
          shopName: 'HomeStyle',
          rating: 4.3,
          soldCount: 10,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'sofa-1',
          name: 'Sofa hiện đại 3 chỗ',
          description: '',
          price: 15_990_000,
          stock: 3,
          category: 'Nội thất',
          imageUrl: '/s.jpg',
          sellerId: 's3',
          shopName: 'HomeStyle',
          rating: 4.1,
          soldCount: 2,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      categories: [
        { id: 'c1', name: 'Gia dụng', slug: 'gia-dung', productCount: 2 },
        { id: 'c2', name: 'Nhà bếp', slug: 'kitchen', productCount: 1 },
        { id: 'c3', name: 'Nội thất', slug: 'furniture', productCount: 1 },
      ],
    }
    const reply = await resolveChatReply('Đồ gia dụng', history, ctx)
    expect(reply.content).not.toMatch(/So sánh 2 sản phẩm đã đính kèm/)
    expect(reply.content).not.toMatch(/Centella|Crop Top/i)
  })

  it('shows seller card for shop follow-up on prior product', async () => {
    const history: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'High Waist Jeans',
        timestamp: '',
        products: [jeansCard],
      },
    ]
    const reply = await resolveChatReply('shop này là ai', history, minimalCtx())
    expect(reply.sellers?.length).toBeGreaterThan(0)
    expect(reply.sellers?.[0]?.shopName).toBe('Fashion Hub')
    expect(reply.content.toLowerCase()).toMatch(/danh thiep|shop/)
  })
})
