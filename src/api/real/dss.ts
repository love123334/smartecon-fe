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
  historicalFrom?: string
  historicalTo?: string
  historicalPeriodLabel?: string
  forecastPeriodLabel?: string
  methodology?: string
  trendFactor?: number
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
export interface DssProfitBreakdownApi {
  revenue: number
  costOfGoodsSold: number
  deliveryCost: number
  platformFee: number
  operatingCost: number
  grossProfit: number
  netProfit: number
  costNotes?: string[]
}

export interface PriceScenarioApi {
  priceChangePercent: number
  cost: number
  newPrice: number
  profitPerProduct: number
  predictedDemand: number
  expectedProfit: number
  expectedRevenue?: number
  profitChangePercent?: number
  profitBreakdown?: DssProfitBreakdownApi
  scenarioLabel?: string
  recommended?: boolean
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
  forecastPeriodDays?: number
  historicalPeriodLabel?: string
  forecastPeriodLabel?: string
  scenarioAssumptionNote?: string
  recommendation?: string
  recommendationReason?: string
  currentSituationBreakdown?: DssProfitBreakdownApi
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
    historicalSales?: { day: number; qty: number }[]
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
  return http.post<DemandPredictionApi>(apiPaths.dss.demandPredictions, body, { timeoutMs: 15_000 })
}

export function recommendPrice(productId: string | number, lookbackDays = 30) {
  return http.get<PriceRecommendationApi>(
    `${apiPaths.dss.price(String(productId))}?lookbackDays=${lookbackDays}`,
  )
}

export function createPricePrediction(body: CreatePricePredictionRequest) {
  return http.post<PricePredictionApi>(apiPaths.dss.pricePredictions, body, { timeoutMs: 15_000 })
}

export interface CustomPriceScenarioRequest {
  productId: number
  fromDate: string
  toDate: string
  customPrice: number
}

export interface CustomPriceScenarioApi {
  productId: number
  productName: string
  currentPrice: number
  customPrice: number
  derivedPriceChangePercent: number
  forecastPeriodDays: number
  forecastPeriodLabel: string
  scenario: PriceScenarioApi
  recommendation: string
  recommendationReason: string
}

export function evaluateCustomPriceScenario(body: CustomPriceScenarioRequest) {
  return http.post<CustomPriceScenarioApi>(
    `${apiPaths.dss.pricePredictions}/custom-scenario`,
    body,
    { timeoutMs: 15_000 },
  )
}

/** POST /api/v1/dss/price-predictions — kept above; seller what-if is under /api/dss */

export interface SellerWhatIfApi {
  currentPrice: number
  costPrice: number
  priceChangePercent?: number
  discountPercentage: number
  newPrice: number
  forecastDemand: number
  predictedDemand: number
  currentProfit: number
  expectedProfit: number
  breakEvenQuantity: number
  additionalUnitsRequired: number
  businessInsight: string
  simulationPeriod?: number
  historicalPeriodLabel?: string
  forecastPeriodLabel?: string
  methodology?: string
  currentRevenue?: number
  expectedRevenue?: number
  profitChangePercent?: number
  currentProfitBreakdown?: DssProfitBreakdownApi
  expectedProfitBreakdown?: DssProfitBreakdownApi
  recommendation?: string
  recommendationReason?: string
}

export interface SellerWhatIfRequest {
  productId: number
  priceChangePercent: number
  simulationPeriod: number
}

export async function analyzeSellerWhatIf(body: SellerWhatIfRequest) {
  // Primary: @RequestMapping("/api/dss/what-if/seller") — not under /api/v1
  try {
    return await http.postAt<SellerWhatIfApi>(
      apiRootWithoutVersion(),
      apiPaths.dss.whatIfSeller,
      body,
      { timeoutMs: 15_000 },
    )
  } catch (e) {
    // Fallback: some BE branches mount the same handler under /api/v1
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
      return http.post<SellerWhatIfApi>(apiPaths.dss.whatIfSeller, body, { timeoutMs: 15_000 })
    }
    throw e
  }
}

export interface TargetProfitRequest {
  productId: number
  targetProfitVnd: number
  simulationPeriod: number
}

export interface TargetProfitApi {
  productId: number
  productName: string
  simulationPeriod: number
  forecastPeriodLabel: string
  historicalPeriodLabel: string
  targetProfitVnd: number
  currentPrice: number
  forecastDemand: number
  currentSituation: DssProfitBreakdownApi
  recommendedPriceChangePercent: number
  recommendedPrice: number
  estimatedDemand: number
  targetSituation: DssProfitBreakdownApi
  profitGapVnd: number
  achievable: boolean
  recommendation: string
  recommendationReason: string
  methodology: string
}

export interface SalesQuantityTargetRequest {
  productId: number
  increasePercent: number
  simulationPeriod: number
}

export interface SalesQuantityTargetApi {
  productId: number
  productName: string
  simulationPeriod: number
  forecastPeriodLabel: string
  increasePercent: number
  currentForecastQuantity: number
  targetQuantity: number
  currentPrice: number
  suggestedPrice: number
  suggestedPriceChangePercent: number
  currentSituation: DssProfitBreakdownApi
  targetSituation: DssProfitBreakdownApi
  profitChangePercent: number
  recommendation: string
  recommendationReason: string
  methodology: string
}

export async function analyzeTargetProfit(body: TargetProfitRequest) {
  try {
    return await http.postAt<TargetProfitApi>(
      apiRootWithoutVersion(),
      `${apiPaths.dss.whatIfSeller}/target-profit`,
      body,
      { timeoutMs: 15_000 },
    )
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
      return http.post<TargetProfitApi>(`${apiPaths.dss.whatIfSeller}/target-profit`, body, {
        timeoutMs: 15_000,
      })
    }
    throw e
  }
}

export async function analyzeSalesQuantityTarget(body: SalesQuantityTargetRequest) {
  try {
    return await http.postAt<SalesQuantityTargetApi>(
      apiRootWithoutVersion(),
      `${apiPaths.dss.whatIfSeller}/sales-quantity-target`,
      body,
      { timeoutMs: 15_000 },
    )
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
      return http.post<SalesQuantityTargetApi>(
        `${apiPaths.dss.whatIfSeller}/sales-quantity-target`,
        body,
        { timeoutMs: 15_000 },
      )
    }
    throw e
  }
}

export function recommendInventory(planningDays: number, productId?: string | number) {
  const qs = new URLSearchParams({ planningDays: String(planningDays) })
  if (productId != null && productId !== '' && productId !== 'all') {
    qs.set('productId', String(productId))
  }
  return http.get<InventoryRecommendationApi>(`${apiPaths.dss.inventory}?${qs}`, {
    timeoutMs: 15_000,
  })
}

export function insightPlan() {
  // AI commentary: fail fast → local fallback
  return http.get<DssInsightPlanApi>(apiPaths.dss.insightsPlan, { timeoutMs: 4_000 })
}
