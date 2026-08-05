import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/http/client'
import {
  formatViDateTime,
  formatViNumber,
  mapDemandPredictionError,
  validateDemandPredictionForm,
  buildDemandPredictionAiInsight,
  buildFlatForecastSeries,
} from '@/utils/demandPrediction'

describe('validateDemandPredictionForm', () => {
  it('accepts a valid payload with positive integers', () => {
    const result = validateDemandPredictionForm({
      productId: 15,
      historicalDays: 90,
      forecastPeriod: 30,
    })

    expect(result).toEqual({
      ok: true,
      payload: {
        productId: 15,
        historicalDays: 90,
        forecastPeriod: 30,
      },
    })
  })

  it('rejects missing or non-positive values', () => {
    const result = validateDemandPredictionForm({
      productId: '',
      historicalDays: 0,
      forecastPeriod: -7,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.productId).toBeTruthy()
    expect(result.errors.historicalDays).toBeTruthy()
    expect(result.errors.forecastPeriod).toBeTruthy()
  })

  it('rejects non-integer values', () => {
    const result = validateDemandPredictionForm({
      productId: 15.5,
      historicalDays: '90.2',
      forecastPeriod: 'abc',
    })

    expect(result.ok).toBe(false)
  })
})

describe('demand prediction response formatting', () => {
  it('formats numbers with vi-VN locale', () => {
    expect(formatViNumber(300)).toMatch(/300/)
    expect(formatViNumber(10.5)).toMatch(/10/)
  })

  it('formats generatedAt safely when null or invalid', () => {
    expect(formatViDateTime(null)).toBe('—')
    expect(formatViDateTime(undefined)).toBe('—')
    expect(formatViDateTime('not-a-date')).toBe('—')
    expect(formatViDateTime('2026-07-26T10:25:00')).not.toBe('—')
  })
})

describe('mapDemandPredictionError', () => {
  it('keeps backend messages for business errors', () => {
    expect(
      mapDemandPredictionError(
        new ApiError('Không đủ dữ liệu để tạo dự báo.', 400),
      ),
    ).toBe('Không đủ dữ liệu để tạo dự báo.')
  })

  it('maps 401/403 with backend message when present', () => {
    expect(
      mapDemandPredictionError(
        new ApiError('You do not have permission to generate a prediction for this product.', 403),
      ),
    ).toContain('permission')

    expect(mapDemandPredictionError(new ApiError('', 401))).toMatch(/đăng nhập/i)
  })

  it('maps successful-looking ApiResponse data contract via create payload shape', () => {
    const successData = {
      productName: 'Nike Air Force',
      historicalDays: 90,
      forecastPeriod: 30,
      averageDailyDemand: 10,
      predictedDemand: 300,
      generatedAt: '2026-07-26T10:25:00',
    }

    expect(formatViNumber(successData.predictedDemand)).toMatch(/300/)
    expect(formatViDateTime(successData.generatedAt)).not.toBe('—')
  })
})

describe('buildDemandPredictionAiInsight', () => {
  it('classifies strong demand and returns actions', () => {
    const insight = buildDemandPredictionAiInsight({
      productName: 'Noise Cancelling Headphones',
      historicalDays: 90,
      forecastPeriod: 30,
      averageDailyDemand: 8.46,
      predictedDemand: 253.8,
    })
    expect(insight.tone).toBe('strong')
    expect(insight.badge).toMatch(/cao/i)
    expect(insight.actions.length).toBeGreaterThan(0)
    expect(insight.risks.length).toBeGreaterThan(0)
    expect(insight.summary).toMatch(/253/)
  })

  it('classifies sparse demand when average is near zero', () => {
    const insight = buildDemandPredictionAiInsight({
      productName: 'SKU chậm',
      historicalDays: 30,
      forecastPeriod: 14,
      averageDailyDemand: 0,
      predictedDemand: 0,
    })
    expect(insight.tone).toBe('sparse')
  })
})

describe('buildFlatForecastSeries', () => {
  it('builds daily points from average demand', () => {
    const rows = buildFlatForecastSeries(2.5, 7, 10)
    expect(rows).toHaveLength(7)
    expect(rows[0]).toEqual({ day: 10, qty: 2.5 })
    expect(rows[6].day).toBe(16)
  })
})
