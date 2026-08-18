import { describe, expect, it } from 'vitest'
import {
  formatForecastMethod,
  formatSignedPercent,
  validateAdvancedPriceChange,
  validateAdvancedPriceForm,
} from '@/utils/advancedPrice'

describe('validateAdvancedPriceForm', () => {
  it('creates the backend payload for a valid form', () => {
    const result = validateAdvancedPriceForm({
      productId: 42,
      fromDate: '2026-01-01',
      toDate: '2026-01-30',
      forecastPeriod: 14,
      estimatedOrderCost: 25_000,
    })

    expect(result).toEqual({
      ok: true,
      payload: {
        productId: 42,
        fromDate: '2026-01-01',
        toDate: '2026-01-30',
        forecastPeriod: 14,
        estimatedOrderCost: 25_000,
      },
    })
  })

  it('rejects invalid product, date range, horizon and cost', () => {
    const result = validateAdvancedPriceForm({
      productId: '',
      fromDate: '2026-01-10',
      toDate: '2026-01-01',
      forecastPeriod: 21,
      estimatedOrderCost: -1,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.productId).toBeTruthy()
    expect(result.errors.toDate).toBeTruthy()
    expect(result.errors.forecastPeriod).toBeTruthy()
    expect(result.errors.estimatedOrderCost).toBeTruthy()
  })

  it('enforces a historical range from 7 to 180 inclusive days', () => {
    const tooShort = validateAdvancedPriceForm({
      productId: 1,
      fromDate: '2026-01-01',
      toDate: '2026-01-06',
      forecastPeriod: 7,
      estimatedOrderCost: 0,
    })
    const tooLong = validateAdvancedPriceForm({
      productId: 1,
      fromDate: '2025-01-01',
      toDate: '2025-07-01',
      forecastPeriod: 30,
      estimatedOrderCost: 0,
    })

    expect(tooShort.ok).toBe(false)
    expect(tooLong.ok).toBe(false)
  })
})

describe('advanced price scenario helpers', () => {
  it('accepts both slider boundaries and rejects values outside them', () => {
    expect(validateAdvancedPriceChange(-70)).toBe('')
    expect(validateAdvancedPriceChange(100)).toBe('')
    expect(validateAdvancedPriceChange(-71)).toBeTruthy()
    expect(validateAdvancedPriceChange(101)).toBeTruthy()
  })

  it('formats backend method and signed percentage labels', () => {
    expect(formatForecastMethod('lightgbm_onnx')).toContain('học máy')
    expect(formatSignedPercent(10)).toContain('+10')
    expect(formatSignedPercent(-10)).toContain('-10')
  })
})
