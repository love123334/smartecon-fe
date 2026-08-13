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
  it('suggests review after price intent with product focus', () => {
    const actions = deriveSuggestedActions('product_price', true, 'customer')
    expect(actions.some((a) => /đánh giá|review/i.test(a.label))).toBe(true)
  })

  it('returns seller DSS follow-ups', () => {
    const actions = deriveSuggestedActions('seller_dss_demand', false, 'seller')
    expect(actions.length).toBeGreaterThan(0)
    expect(actions[0].prompt.length).toBeGreaterThan(3)
  })
})

describe('chatTelemetry', () => {
  it('fills defaults', () => {
    const t = createChatTelemetry({
      intent: 'product_info',
      intentScore: 40,
      finalSource: 'local',
      followUp: false,
      hasAttachments: false,
    })
    expect(t.llmCalled).toBe(false)
    expect(t.localLatencyMs).toBe(0)
    expect(t.latencyMs).toBe(0)
  })
})
