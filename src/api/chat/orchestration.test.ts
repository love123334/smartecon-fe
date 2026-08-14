import { describe, expect, it } from 'vitest'
import { routeFromIntent } from '@/api/chat/intentRouter'
import { buildChatMemoryLayers, RECENT_TURN_LIMIT } from '@/api/chat/conversationMemory'
import { getAllowedTools, executeChatTools } from '@/api/chat/chatTools'
import { emptyConversationContext } from '@/api/chat/conversationContext'
import type { ChatMessage } from '@/types'
import type { ChatContext } from '@/api/chat/context'

describe('intentRouter', () => {
  it('routes product search to PRODUCT_QUERY', () => {
    expect(routeFromIntent('product_search')).toBe('PRODUCT_QUERY')
  })

  it('routes seller what-if to WHAT_IF', () => {
    expect(routeFromIntent('seller_whatif')).toBe('WHAT_IF')
  })

  it('routes seller revenue to SALES_ANALYSIS', () => {
    expect(routeFromIntent('seller_revenue')).toBe('SALES_ANALYSIS')
  })
})

describe('conversationMemory', () => {
  const history: ChatMessage[] = Array.from({ length: 12 }, (_, i) => ({
    id: `m-${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: i % 2 === 0 ? `cau hoi ${i}` : `tra loi ${i}`,
    timestamp: new Date().toISOString(),
  }))

  it('keeps only recent turns for LLM', () => {
    const layers = buildChatMemoryLayers(
      history,
      emptyConversationContext(),
      'product_search',
      'customer',
      'PRODUCT_QUERY',
    )
    expect(layers.recentTurns.length).toBe(RECENT_TURN_LIMIT)
    expect(layers.summary.length).toBeGreaterThan(0)
  })
})

describe('chatTools RBAC', () => {
  it('seller cannot get manager-only tools on product route', () => {
    const tools = getAllowedTools('seller', 'PRODUCT_QUERY')
    expect(tools).not.toContain('get_manager_kpi')
    expect(tools).toContain('search_products')
  })

  it('customer cannot get seller sales tool', () => {
    const tools = getAllowedTools('customer', 'SALES_ANALYSIS')
    expect(tools).not.toContain('get_seller_sales')
  })

  it('executeChatTools returns search results from context', () => {
    const ctx: ChatContext = {
      role: 'customer',
      products: [
        {
          id: '1',
          name: 'Tai nghe X',
          price: 100_000,
          stock: 5,
          category: 'Điện tử',
          imageUrl: '',
          sellerId: 's1',
          rating: 4,
          soldCount: 1,
          createdAt: '2026-01-01',
          description: 'Tai nghe test',
        },
      ],
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
    const results = executeChatTools('customer', 'PRODUCT_QUERY', ctx)
    expect(results.some((r) => r.name === 'search_products' && r.ok)).toBe(true)
  })
})
