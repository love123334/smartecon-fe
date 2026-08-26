import { describe, expect, it } from 'vitest'
import { interpretDemandTrend } from './demandTrendInsight'

describe('interpretDemandTrend', () => {
  it('labels a late ramp then high plateau as tăng → ổn định ở mức cao, not đang giảm', () => {
    const history: number[] = []
    for (let i = 0; i < 140; i++) history.push(3 + (i % 3 === 0 ? 1 : 0))
    for (let i = 0; i < 40; i++) history.push(4 + Math.round((i * 9) / 39))
    const wiggle = [13.2, 14.0, 13.1, 12.4, 11.8, 12.2, 11.6]
    const forecast = Array.from({ length: 30 }, (_, i) => 13.5 - 0.06 * i + (i % 3 === 0 ? 0.4 : -0.2))
    const sideways = Array.from({ length: 30 }, (_, i) => wiggle[i % wiggle.length])

    const plateau = interpretDemandTrend(history, forecast)
    expect(plateau?.historyLabel).toBe('Đang tăng mạnh')
    expect(plateau?.forecastLabel).toBe('Ổn định ở mức cao')
    expect(plateau?.combined).toBe('up_to_high_stable')
    expect(plateau?.insightLabel).toBe('Tăng → ổn định ở mức cao')
    expect(plateau?.recommendation.toLowerCase()).not.toContain('đang giảm')

    const repeating = interpretDemandTrend(history, sideways)
    expect(repeating?.combined).toBe('up_to_high_stable')
    expect(repeating?.insightLabel).toBe('Tăng → ổn định ở mức cao')
  })

  it('still flags a real cool-down after a ramp', () => {
    const history = Array.from({ length: 30 }, (_, i) => 3 + Math.round((i * 10) / 29))
    const forecast = Array.from({ length: 30 }, (_, i) => 13 - i * 0.22)
    const insight = interpretDemandTrend(history, forecast)
    expect(insight?.combined).toBe('up_then_cool')
    expect(insight?.insightLabel).toBe('Tăng nhưng có dấu hiệu hạ nhiệt')
  })

  it('keeps a short steadily rising forecast as continue_up', () => {
    const history = Array.from({ length: 30 }, (_, i) => 4 + Math.floor(i / 3))
    const forecast = [14, 14.4, 14.8, 15.2, 15.6, 16, 16.4]
    const insight = interpretDemandTrend(history, forecast)
    expect(insight?.combined).toBe('continue_up')
  })
})
