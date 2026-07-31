import { http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'

export interface DemandForecastApi {
  productId: number
  productName: string
  historicalDays: number
  forecastDays: number
  averageDailyDemand: number
  predictedDemand: number
  method: string
  insufficientData: boolean
  historicalSales: { day: number; qty: number; date?: string }[]
  forecastSales: { day: number; qty: number }[]
  generatedAt: string
}

export interface PriceRecommendationApi {
  productId: number
  productName: string
  currentPrice: number
  recommendedPrice: number
  priceChangePct: number
  elasticity: number
  currentDemand: number
  predictedDemand: number
  expectedRevenue: number
  action: 'increase' | 'decrease' | 'keep' | string
  message: string
  insight: string
  chart: { label: string; averagePrice: number; quantitySold: number }[]
  generatedAt: string
}

export interface InventoryRecommendationApi {
  planningDays: number
  overallStatus: 'need' | 'sufficient' | string
  recommendationMessage: string
  rows: Array<{
    productId: number
    productName: string
    currentStock: number
    averageDailyDemand: number
    leadTimeDays: number
    safetyStock: number
    reorderPoint: number
    recommendedOrder: number
    status: 'need' | 'sufficient' | string
    statusLabel: string
  }>
  generatedAt: string
}

export interface DssInsightPlanApi {
  source: string
  commentary: string
  metrics: Record<string, unknown>
  powerBiEmbedUrl: string
  powerBiReportTitle: string
  powerBiFeedHint: string
  generatedAt: string
}

export function forecastDemand(
  productId: string | number,
  historyDays: number,
  forecastDays: number,
) {
  return http.get<DemandForecastApi>(
    `${apiPaths.dss.demand(String(productId))}?historyDays=${historyDays}&forecastDays=${forecastDays}`,
  )
}

export function recommendPrice(productId: string | number, lookbackDays = 30) {
  return http.get<PriceRecommendationApi>(
    `${apiPaths.dss.price(String(productId))}?lookbackDays=${lookbackDays}`,
  )
}

export function recommendInventory(planningDays: number, productId?: string | number) {
  const qs = new URLSearchParams({ planningDays: String(planningDays) })
  if (productId != null && productId !== '' && productId !== 'all') {
    qs.set('productId', String(productId))
  }
  return http.get<InventoryRecommendationApi>(`${apiPaths.dss.inventory}?${qs}`)
}

export function insightPlan() {
  return http.get<DssInsightPlanApi>(apiPaths.dss.insightsPlan)
}
