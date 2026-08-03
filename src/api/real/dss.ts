import { ApiError, apiRootWithoutVersion, http } from '@/api/http/client'
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

/** POST /api/v1/dss/demand-predictions */
export interface DemandPredictionApi {
  productName: string
  historicalDays: number
  forecastPeriod: number
  averageDailyDemand: number
  predictedDemand: number
  generatedAt: string | null
}

export interface CreateDemandPredictionRequest {
  productId: number
  forecastPeriod: number
  historicalDays: number
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

/** POST /api/v1/dss/price-predictions */
export interface PriceScenarioApi {
  priceChangePercent: number
  cost: number
  newPrice: number
  profitPerProduct: number
  predictedDemand: number
  expectedProfit: number
}

export interface PricePredictionApi {
  productId: number
  productName: string
  fromDate: string
  toDate: string
  currentPrice: number
  cost: number
  averageElasticity: number
  totalQuantitySold: number
  bestScenario: PriceScenarioApi | null
  scenarios: PriceScenarioApi[] | null
}

export interface CreatePricePredictionRequest {
  productId: number
  fromDate: string
  toDate: string
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

export function createDemandPrediction(body: CreateDemandPredictionRequest) {
  return http.post<DemandPredictionApi>(apiPaths.dss.demandPredictions, body)
}

export function recommendPrice(productId: string | number, lookbackDays = 30) {
  return http.get<PriceRecommendationApi>(
    `${apiPaths.dss.price(String(productId))}?lookbackDays=${lookbackDays}`,
  )
}

export function createPricePrediction(body: CreatePricePredictionRequest) {
  return http.post<PricePredictionApi>(apiPaths.dss.pricePredictions, body)
}

/** POST /api/v1/dss/price-predictions — kept above; seller what-if is under /api/dss */

export interface SellerWhatIfApi {
  currentPrice: number
  costPrice: number
  discountPercentage: number
  newPrice: number
  forecastDemand: number
  predictedDemand: number
  currentProfit: number
  expectedProfit: number
  breakEvenQuantity: number
  additionalUnitsRequired: number
  businessInsight: string
}

export interface SellerWhatIfRequest {
  productId: number
  discountPercentage: number
  simulationPeriod: number
}

export async function analyzeSellerWhatIf(body: SellerWhatIfRequest) {
  // Primary: @RequestMapping("/api/dss/what-if/seller") — not under /api/v1
  try {
    return await http.postAt<SellerWhatIfApi>(
      apiRootWithoutVersion(),
      apiPaths.dss.whatIfSeller,
      body,
    )
  } catch (e) {
    // Fallback: some BE branches mount the same handler under /api/v1
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
      return http.post<SellerWhatIfApi>(apiPaths.dss.whatIfSeller, body)
    }
    throw e
  }
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
