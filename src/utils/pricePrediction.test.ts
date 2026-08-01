import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/http/client'
import type { PriceScenarioApi } from '@/api/real/dss'
import {
  defaultPriceRange,
  formatElasticity,
  formatSignedPercent,
  formatVndCurrency,
  isBestScenarioRow,
  mapPricePredictionError,
  normalizeScenarios,
  scenarioTone,
  todayIsoDate,
  validatePricePredictionForm,
} from '@/utils/pricePrediction'

describe('validatePricePredictionForm', () => {
  const now = new Date('2026-07-30T12:00:00')

  it('accepts valid YYYY-MM-DD range not in the future', () => {
    const result = validatePricePredictionForm(
      {
        productId: 1,
        fromDate: '2026-07-01',
        toDate: '2026-07-30',
      },
      now,
    )

    expect(result).toEqual({
      ok: true,
      payload: {
        productId: 1,
        fromDate: '2026-07-01',
        toDate: '2026-07-30',
      },
    })
  })

  it('rejects fromDate > toDate', () => {
    const result = validatePricePredictionForm(
      {
        productId: 1,
        fromDate: '2026-07-30',
        toDate: '2026-07-01',
      },
      now,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.fromDate).toMatch(/lớn hơn/i)
  })

  it('rejects future toDate', () => {
    const result = validatePricePredictionForm(
      {
        productId: 1,
        fromDate: '2026-07-01',
        toDate: '2026-08-01',
      },
      now,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.toDate).toMatch(/tương lai/i)
  })

  it('rejects invalid productId', () => {
    const result = validatePricePredictionForm(
      {
        productId: '',
        fromDate: '2026-07-01',
        toDate: '2026-07-30',
      },
      now,
    )
    expect(result.ok).toBe(false)
  })
})

describe('price prediction formatting', () => {
  it('formats VND with vi-VN currency', () => {
    expect(formatVndCurrency(100000)).toMatch(/100/)
    expect(formatVndCurrency(null)).toBe('—')
  })

  it('formats percent with + for positive values', () => {
    expect(formatSignedPercent(5)).toBe('+5%')
    expect(formatSignedPercent(0)).toBe('0%')
    expect(formatSignedPercent(-10)).toBe('-10%')
  })

  it('formats elasticity including negatives', () => {
    expect(formatElasticity(-3)).toMatch(/-3/)
  })
})

describe('best scenario matching', () => {
  const best: PriceScenarioApi = {
    priceChangePercent: 0,
    cost: 70000,
    newPrice: 100000,
    profitPerProduct: 30000,
    predictedDemand: 200,
    expectedProfit: 6000000,
  }

  it('matches by backend priceChangePercent only', () => {
    expect(isBestScenarioRow(best, best)).toBe(true)
    expect(
      isBestScenarioRow(
        { ...best, priceChangePercent: -10, expectedProfit: 9_999_999 },
        best,
      ),
    ).toBe(false)
  })

  it('normalizes null/empty scenarios safely', () => {
    expect(normalizeScenarios(null)).toEqual([])
    expect(normalizeScenarios(undefined)).toEqual([])
    expect(normalizeScenarios([best])).toHaveLength(1)
  })

  it('maps scenario tone labels', () => {
    expect(scenarioTone(-10)).toBe('decrease')
    expect(scenarioTone(0)).toBe('keep')
    expect(scenarioTone(5)).toBe('increase')
  })
})

describe('mapPricePredictionError', () => {
  it('keeps backend insufficient-data message', () => {
    expect(
      mapPricePredictionError(
        new ApiError('Không đủ dữ liệu để tạo khuyến nghị giá.', 400),
      ),
    ).toBe('Không đủ dữ liệu để tạo khuyến nghị giá.')
  })

  it('handles 401/403/404/500', () => {
    expect(mapPricePredictionError(new ApiError('', 401))).toMatch(/đăng nhập/i)
    expect(mapPricePredictionError(new ApiError('Forbidden', 403))).toBe('Forbidden')
    expect(mapPricePredictionError(new ApiError('', 404))).toMatch(/sản phẩm/i)
    expect(mapPricePredictionError(new ApiError('', 500))).toMatch(/Máy chủ/i)
  })
})

describe('defaultPriceRange', () => {
  it('returns ~90-day window ending today', () => {
    const now = new Date('2026-07-30T08:00:00')
    const range = defaultPriceRange(now)
    expect(range.toDate).toBe(todayIsoDate(now))
    expect(range.fromDate).toBe('2026-05-02')
  })
})
