import { describe, expect, it } from 'vitest'
import { repairPriceFactsInReply } from '@/api/chat/factRepair'
import { deriveSuggestedActions } from '@/api/chat/suggestedActions'
import { createChatTelemetry } from '@/api/chat/chatTelemetry'

describe('factRepair', () => {
  it('appends verified price when LLM contradicts', () => {
    const repaired = repairPriceFactsInReply('Sản phẩm khoảng **5.000.000₫** nhé.', {
      intent: 'product_price',
      intentScore: 50,
      lines: [],
      allowedProductNames: ['KeyPro K200'],
      verifiedPricesVnd: [2_490_000],
      localDraft: 'Giá 2.490.000₫',
      products: [],
      sellers: [],
    })
    expect(repaired).toContain('2.490.000')
    expect(repaired).toContain('KeyPro')
  })

  it('returns null when prices align', () => {
    const repaired = repairPriceFactsInReply('Giá **2.490.000₫**', {
      intent: 'product_price',
      intentScore: 50,
      lines: [],
      allowedProductNames: ['KeyPro'],
      verifiedPricesVnd: [2_490_000],
      localDraft: '',
      products: [],
      sellers: [],
    })
    expect(repaired).toBeNull()
  })
})

describe('suggestedActions', () => {
  it('returns seller nav chips for revenue / orders', () => {
    const revenue = deriveSuggestedActions('seller_revenue', false, 'seller')
    expect(revenue.some((a) => a.to === '/seller/sales')).toBe(true)
    expect(revenue.some((a) => a.to === '/seller/orders')).toBe(true)

    const orders = deriveSuggestedActions('seller_orders', false, 'seller')
    expect(orders[0]?.to).toBe('/seller/orders')
  })

  it('returns empty for customer shop intents', () => {
    expect(deriveSuggestedActions('product_price', true, 'customer')).toEqual([])
    expect(deriveSuggestedActions('category_browse', false, 'customer')).toEqual([])
  })
})

describe('chatTelemetry', () => {
  it('creates telemetry payload', () => {
    const t = createChatTelemetry({
      intent: 'product_price',
      intentScore: 50,
      llmCalled: false,
      localLatencyMs: 1,
      latencyMs: 2,
      finalSource: 'local',
      followUp: false,
      hasAttachments: false,
    })
    expect(t.intent).toBe('product_price')
    expect(t.finalSource).toBe('local')
  })
})
