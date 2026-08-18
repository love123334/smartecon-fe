import { describe, expect, it } from 'vitest'
import {
  ORDER_ECONOMICS_DEFAULTS,
  calculateOrderEconomics,
  validateOrderEconomicsInput,
} from '@/utils/orderEconomics'

describe('calculateOrderEconomics', () => {
  it('implements the unit economics formula from the reference calculator', () => {
    const result = calculateOrderEconomics({
      price: 100_000,
      costPrice: 30_000,
      ...ORDER_ECONOMICS_DEFAULTS,
    })

    expect(result.platformFeeAmount).toBe(12_000)
    expect(result.affiliateFeeAmount).toBe(8_000)
    expect(result.refundReserveAmount).toBe(2_000)
    expect(result.preAdsContribution).toBe(44_000)
    expect(result.contributionPerOrder).toBe(32_000)
    expect(result.contributionMarginPercent).toBe(32)
    expect(result.breakEvenAdsPerOrder).toBe(44_000)
    expect(result.decision).toBe('SCALE')
  })

  it('classifies positive margins below 15% as TEST', () => {
    const result = calculateOrderEconomics({
      price: 100_000,
      costPrice: 60_000,
      packagingCost: 4_000,
      platformFeePercent: 12,
      affiliatePercent: 8,
      adsPerOrder: 10_000,
      refundReservePercent: 2,
    })
    expect(result.contributionMarginPercent).toBe(4)
    expect(result.decision).toBe('TEST')
  })

  it('classifies zero or negative contribution as FIX', () => {
    const result = calculateOrderEconomics({
      price: 100_000,
      costPrice: 70_000,
      ...ORDER_ECONOMICS_DEFAULTS,
    })
    expect(result.contributionPerOrder).toBeLessThanOrEqual(0)
    expect(result.decision).toBe('FIX')
  })
})

describe('validateOrderEconomicsInput', () => {
  it('rejects missing database values and invalid editable costs', () => {
    const errors = validateOrderEconomicsInput({
      price: 0,
      costPrice: Number.NaN,
      packagingCost: -1,
      platformFeePercent: 101,
      affiliatePercent: -1,
      adsPerOrder: -1,
      refundReservePercent: 101,
    })
    expect(Object.keys(errors)).toHaveLength(7)
  })
})
