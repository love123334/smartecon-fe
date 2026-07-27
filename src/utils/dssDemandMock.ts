/** Mock engine — Moving Average demand forecast (FE demo) */

export interface DemandProductOption {
  id: string
  name: string
}

export const DEMAND_PRODUCTS: DemandProductOption[] = [
  { id: '1', name: 'Tai nghe Bluetooth Pro ANC' },
  { id: '2', name: 'Bàn phím cơ RGB KeyPro K87' },
  { id: '3', name: 'Giày chạy bộ AirFlex Marathon' },
  { id: '4', name: 'Nồi chiên không dầu 5L' },
]

/** Spec sample historical series */
export const SAMPLE_HISTORICAL = [9, 11, 10, 13, 12, 9, 10, 11, 12, 10]

export type ForecastPeriodKey = '7' | '30' | '90'
export type HistoricalWindowKey = '30' | '90' | '180'

export const FORECAST_PERIOD_OPTIONS = [
  { value: '7' as const, label: '7 ngày tới', days: 7 },
  { value: '30' as const, label: '30 ngày tới', days: 30 },
  { value: '90' as const, label: '90 ngày tới', days: 90 },
]

export const HISTORICAL_WINDOW_OPTIONS = [
  { value: '30' as const, label: '30 ngày gần nhất', days: 30 },
  { value: '90' as const, label: '90 ngày gần nhất', days: 90 },
  { value: '180' as const, label: '180 ngày gần nhất', days: 180 },
]

export interface DemandForecastResult {
  productName: string
  historicalWindowLabel: string
  forecastPeriodLabel: string
  historicalDays: number
  forecastDays: number
  averageDailyDemand: number
  predictedDemand: number
  generatedAt: string
  historicalSales: { day: number; qty: number }[]
  forecastSales: { day: number; qty: number }[]
}

function seededSeries(seed: number, length: number, base: number[]): number[] {
  const out: number[] = []
  for (let i = 0; i < length; i++) {
    const sample = base[i % base.length]
    const wobble = ((seed * (i + 3)) % 5) - 2
    out.push(Math.max(1, sample + wobble))
  }
  return out
}

export function generateDemandForecast(input: {
  productId: string
  productName: string
  forecastKey: ForecastPeriodKey
  historicalKey: HistoricalWindowKey
}): DemandForecastResult | null {
  const forecast = FORECAST_PERIOD_OPTIONS.find((o) => o.value === input.forecastKey)!
  const hist = HISTORICAL_WINDOW_OPTIONS.find((o) => o.value === input.historicalKey)!

  // Demo: product id "3" simulates insufficient data when historical = 180
  if (input.productId === '3' && input.historicalKey === '180') {
    return null
  }

  const seed = Number(input.productId) || 1
  const seriesLen = Math.min(hist.days, 14)
  const series = seededSeries(seed, seriesLen, SAMPLE_HISTORICAL)
  const avg = series.reduce((a, b) => a + b, 0) / series.length
  const avgRounded = Math.round(avg * 10) / 10
  const predicted = Math.round(avgRounded * forecast.days)

  const historicalSales = series.map((qty, i) => ({ day: i + 1, qty }))
  const lastDay = seriesLen
  const forecastSales = [
    { day: lastDay, qty: series[series.length - 1] },
    { day: lastDay + forecast.days, qty: Math.round(avgRounded) },
  ]

  return {
    productName: input.productName,
    historicalWindowLabel: hist.label,
    forecastPeriodLabel: forecast.label,
    historicalDays: hist.days,
    forecastDays: forecast.days,
    averageDailyDemand: avgRounded,
    predictedDemand: predicted,
    generatedAt: new Date().toLocaleString('vi-VN'),
    historicalSales,
    forecastSales,
  }
}
