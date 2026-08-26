import { describe, expect, it } from 'vitest'
import { repairPriceFactsInReply } from '@/api/chat/factRepair'
import { deriveSuggestedActions } from '@/api/chat/suggestedActions'
import { createChatTelemetry } from '@/api/chat/chatTelemetry'
import { detectIntent } from '@/api/chat/intents'
import { resolveIntentForRole } from '@/api/chat/rolePolicy'
import { sanitizeChatReply, softenLocalFallback } from '@/api/chat/responses'
import { looksLikePromptLeak, looksLikeSafetyMetadataLeak } from '@/api/chat/followup'

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

describe('seller demand intent', () => {
  it('routes future customer demand to seller_dss_demand', () => {
    const q = 'Nhu cầu khách hàng trong tương lai'
    const hit = detectIntent(q, 'seller')
    expect(hit?.intent).toBe('seller_dss_demand')
    expect(resolveIntentForRole(hit?.intent ?? null, 'seller', q)).toBe('seller_dss_demand')
  })
})

describe('sanitizeChatReply', () => {
  it('strips leaked Gemini safety metadata', () => {
    const raw =
      'User Safety: safe\nResponse Safety: safe\nPhản hồi An toàn: an toàn'
    expect(sanitizeChatReply(raw)).toBe('')
    expect(looksLikeSafetyMetadataLeak(raw)).toBe(true)
  })

  it('strips echoed internal prompt / draft scaffolding', () => {
    const raw = `[English gloss — internal]
search for tai nghe

Bản nháp trợ lý (cần chỉnh cho đúng PLATFORM_FACTS và rõ ràng hơn):
hello
Hãy viết lại câu trả lời cuối cùng cho khách.

Tai nghe này nghe ổn trong tầm giá.`
    const cleaned = sanitizeChatReply(raw)
    expect(cleaned).toMatch(/Tai nghe này nghe ổn/i)
    expect(cleaned).not.toMatch(/English gloss|Bản nháp trợ lý|PLATFORM_FACTS/i)
    expect(looksLikePromptLeak(raw)).toBe(true)
    expect(looksLikePromptLeak(cleaned)).toBe(false)
  })

  it('hides keyword-router fallback copy', () => {
    const dumped =
      'Mình chưa hiểu rõ câu hỏi — bạn muốn hỏi về **sản phẩm nào**, **giá**?\n\nThử hỏi cụ thể, vd:\n• "Doanh thu tháng này"'
    const softened = softenLocalFallback(dumped, false)
    expect(softened).toMatch(/Cứ hỏi tự nhiên/i)
    expect(softened).not.toMatch(/Doanh thu tháng này|keyword/i)
  })
})
