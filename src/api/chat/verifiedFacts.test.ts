import { describe, expect, it } from 'vitest'
import { buildVerifiedFacts, extractVndNumbers } from '@/api/chat/verifiedFacts'
import type { ChatContext } from '@/api/chat/context'

const baseCtx = (): ChatContext => ({
  role: 'customer',
  userName: 'Lan',
  products: [],
  sellerProducts: [],
  categories: [],
  cartLines: [],
  cartItemCount: 0,
  cartTotal: 0,
  orders: [],
  purchaseOrders: [],
  recommendations: [],
  sellerDashboard: null,
  salesPerformance: null,
  sellerInsights: [],
  managerInsights: [],
  categoryChart: [],
  users: [],
  systemMetrics: [],
  publicVouchers: [],
  dataSource: 'api',
  backendOnline: true,
  catalogSource: 'backend',
  enrichment: undefined,
})

describe('extractVndNumbers', () => {
  it('parses formatted VND', () => {
    expect(extractVndNumbers('Giá **1.890.000 ₫**')).toContain(1_890_000)
  })
})

describe('buildVerifiedFacts', () => {
  it('collects product prices from local payload', () => {
    const facts = buildVerifiedFacts(
      baseCtx(),
      'product_price',
      12,
      {
        content: '**Tai nghe X** đang bán **1.890.000 ₫**.',
        products: [
          {
            id: '1',
            name: 'Tai nghe X',
            price: 1_890_000,
            stock: 5,
            shopName: 'Minh Shop',
            imageUrl: '',
          },
        ],
      },
    )
    expect(facts.verifiedPricesVnd).toContain(1_890_000)
    expect(facts.allowedProductNames).toContain('Tai nghe X')
    expect(facts.localDraft).toContain('Tai nghe X')
  })
})
