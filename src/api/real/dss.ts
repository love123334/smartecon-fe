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
  historicalSales: { day?: number; date?: string; qty: number }[]
  forecastSales: { day?: number; date?: string; qty: number }[]
  featureSnapshot?: DemandFeatureSnapshotApi
  generatedAt: string
}

export interface DemandFeatureSnapshotApi {
  method?: string
  statisticalMethod?: string
  forecastStrategy?: string
  onnxModelAvailable?: boolean
  onnxModelUsed?: boolean
  totalHistoricalQuantity?: number
  positiveDays?: number
  recentAverageDailyDemand?: number
  mediumAverageDailyDemand?: number
  longAverageDailyDemand?: number
  previousAverageDailyDemand?: number
  momentum?: number
  trendSlope?: number
  historyTrend?: 'up' | 'down' | 'stable' | 'seasonal'
  historyTrendLabel?: string
  forecastTrend?: number
  forecastTrendDirection?: 'up' | 'down' | 'stable' | 'seasonal'
  forecastTrendLabel?: string
  forecastTrendSlope?: number
  trendBreakDate?: string | null
  trendDivergenceReason?: string | null
  trendCombined?: string
  trendInsightLabel?: string
  trendInsightDetail?: string
  trendRecommendation?: string
  lag7?: number
  seasonalSignal?: number
  currentPrice?: number
  currentStock?: number
  reservedStock?: number
  stockCoverDays?: number
  averageRating?: number
  reviewCount?: number
  insufficientData?: boolean
  baseForecastDailyDemand?: number
  forecastAverageDailyDemand?: number
}

/** POST /api/v1/dss/demand-predictions */
export interface DssForecastDayApi {
  date: string
  predictedQty: number
  holidayNote?: string | null
}

export interface DssHolidayImpactApi {
  code: string
  label: string
  start: string
  end: string
  demandMultiplier: number
  note?: string
  priceImpactNote?: string
}

export interface DssPriceChangeImpactApi {
  changedAt: string
  oldPrice: number
  newPrice: number
  priceChangePercent: number
  avgDailyQtyBefore: number
  avgDailyQtyAfter: number
  quantityChangePercent: number
  windowDays: number
  summary: string
}

export interface DssProductContextApi {
  listedAt?: string | null
  daysListed?: number
  firstSaleDate?: string | null
  daysSinceFirstSale?: number | null
  priceChangeCount?: number
  shopSalesRank?: number | null
  shopProductCount?: number | null
  performanceTier?: string
  performanceSummary?: string
}

export interface DssAiInsightApi {
  title: string
  summary: string
  provider?: string
  fallback?: boolean
  disclaimer?: string
}

export interface DemandPredictionApi {
  productName: string
  historicalDays: number
  forecastPeriod: number
  averageDailyDemand: number
  predictedDemand: number
  seasonalityAdjustedDemand?: number
  holidayAdjustmentFactor?: number
  generatedAt: string | null
  historicalFrom?: string
  historicalTo?: string
  historicalPeriodLabel?: string
  forecastPeriodLabel?: string
  forecastFrom?: string
  forecastTo?: string
  methodology?: string
  trendFactor?: number
  forecastSeries?: DssForecastDayApi[]
  upcomingHolidays?: DssHolidayImpactApi[]
  productContext?: DssProductContextApi
  priceChangeImpacts?: DssPriceChangeImpactApi[]
  aiInsight?: DssAiInsightApi
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
  forecastFrom?: string
  forecastTo?: string
  scenarioAssumptionNote?: string
  recommendation?: string
  recommendationReason?: string
  currentSituationBreakdown?: DssProfitBreakdownApi
  productContext?: DssProductContextApi
  priceChangeImpacts?: DssPriceChangeImpactApi[]
  upcomingHolidays?: DssHolidayImpactApi[]
  aiInsight?: DssAiInsightApi
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
    { timeoutMs: DSS_GENERATE_TIMEOUT_MS },
  )
}

/** DSS generate endpoints — DB + optional AI; allow Railway cold start. */
const DSS_GENERATE_TIMEOUT_MS = 45_000

export function createDemandPrediction(body: CreateDemandPredictionRequest) {
  return http.post<DemandPredictionApi>(apiPaths.dss.demandPredictions, body, {
    timeoutMs: DSS_GENERATE_TIMEOUT_MS,
  })
}

export function recommendPrice(productId: string | number, lookbackDays = 30) {
  return http.get<PriceRecommendationApi>(
    `${apiPaths.dss.price(String(productId))}?lookbackDays=${lookbackDays}`,
  )
}

export function createPricePrediction(body: CreatePricePredictionRequest) {
  return http.post<PricePredictionApi>(apiPaths.dss.pricePredictions, body, {
    timeoutMs: DSS_GENERATE_TIMEOUT_MS,
  })
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

export type AdvancedPriceSessionStatus = 'ACTIVE' | 'APPLIED'

export interface AdvancedPriceProductSummaryApi {
  productId: number
  productName: string
  fromDate: string
  toDate: string
  forecastPeriod: number
  currentPrice: number
  costPrice: number
  estimatedOrderCost: number
  historicalQuantitySold: number
}

export interface AdvancedPriceScenarioApi {
  scenarioId: number
  priceChangePercent: number
  costPrice: number
  newPrice: number
  profitPerProduct: number
  baselineForecastDemand: number
  demandMultiplier: number
  forecastDemand: number
  expectedProfit: number
  createdAt: string
  appliedAt: string | null
  applied: boolean
}

export interface AdvancedPriceSessionApi {
  sessionId: number
  status: AdvancedPriceSessionStatus
  productSummary: AdvancedPriceProductSummaryApi
  averageElasticity: number
  elasticitySource: 'SELECTED_RANGE' | 'ALL_HISTORY_FALLBACK' | string
  baselineForecastDemand: number
  forecastMethod: string
  latestScenario: AdvancedPriceScenarioApi | null
  scenarios: AdvancedPriceScenarioApi[]
  scenarioCount: number
  maxScenarios: number
  appliedAt: string | null
  createdAt: string
}

export interface CreateAdvancedPriceSessionRequest {
  productId: number
  fromDate: string
  toDate: string
  forecastPeriod: 7 | 14 | 30
  estimatedOrderCost: number
}

export interface CreateAdvancedPriceScenarioRequest {
  priceChangePercent: number
}

export interface ApplyAdvancedPriceScenarioApi {
  sessionId: number
  scenarioId: number
  productId: number
  oldPrice: number
  newPrice: number
  priceChangePercent: number
  appliedAt: string
}

export function createAdvancedPriceSession(body: CreateAdvancedPriceSessionRequest) {
  return http.post<AdvancedPriceSessionApi>(apiPaths.dss.advancedPriceSessions, body, {
    timeoutMs: 30_000,
  })
}

export function getAdvancedPriceSession(sessionId: string | number) {
  return http.get<AdvancedPriceSessionApi>(
    apiPaths.dss.advancedPriceSession(String(sessionId)),
    { timeoutMs: 15_000 },
  )
}

export function createAdvancedPriceScenario(
  sessionId: string | number,
  body: CreateAdvancedPriceScenarioRequest,
) {
  return http.post<AdvancedPriceSessionApi>(
    apiPaths.dss.advancedPriceScenarios(String(sessionId)),
    body,
    { timeoutMs: 15_000 },
  )
}

export function applyAdvancedPriceScenario(
  sessionId: string | number,
  scenarioId: string | number,
) {
  return http.post<ApplyAdvancedPriceScenarioApi>(
    apiPaths.dss.applyAdvancedPriceScenario(String(sessionId), String(scenarioId)),
    {},
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

/** POST what-if — legacy /api/dss first (Railway prod); fallback /api/v1 after BE alias deploy. */
async function postSellerWhatIf<T>(path: string, body: unknown) {
  const legacyPath = path.replace(/^\/?/, '')
  try {
    return await http.postAt<T>(apiRootWithoutVersion(), legacyPath, body, {
      timeoutMs: DSS_GENERATE_TIMEOUT_MS,
    })
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
      return http.post<T>(path, body, { timeoutMs: DSS_GENERATE_TIMEOUT_MS })
    }
    throw e
  }
}

export async function analyzeSellerWhatIf(body: SellerWhatIfRequest) {
  return postSellerWhatIf<SellerWhatIfApi>(apiPaths.dss.whatIfSeller, body)
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
  return postSellerWhatIf<TargetProfitApi>(
    `${apiPaths.dss.whatIfSeller}/target-profit`,
    body,
  )
}

export async function analyzeSalesQuantityTarget(body: SalesQuantityTargetRequest) {
  return postSellerWhatIf<SalesQuantityTargetApi>(
    `${apiPaths.dss.whatIfSeller}/sales-quantity-target`,
    body,
  )
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
  return http.get<DssInsightPlanApi>(apiPaths.dss.insightsPlan, {
    timeoutMs: DSS_GENERATE_TIMEOUT_MS,
  })
}

export interface BusinessHealthApi {
  healthScore: number
  healthStatus: 'HEALTHY' | 'MODERATE' | 'AT_RISK' | string
  healthStatusLabel: string
  overallEvaluation: string
  revenueTrendScore: number
  orderTrendScore: number
  profitTrendScore: number
  inventoryHealthScore: number
  demandTrendScore: number
  recentRevenue: number
  previousRevenue: number
  revenueGrowthPercent: number
  recentOrders: number
  previousOrders: number
  orderGrowthPercent: number
  recentEstimatedProfit: number
  profitMarginPercent: number
  totalProducts: number
  lowStockProducts: number
  outOfStockProducts: number
  inventoryHealthyRate: number
  averageDailyDemand: number
  demandGrowthPercent: number
  keyStrengths: string[]
  riskAlerts: string[]
  actionRecommendations: string[]
  topRestockPriorities: Array<{
    productId: number
    productName: string
    currentStock: number
    reorderPoint: number
    restockScore: number
    averageDailyDemand: number
    status: string
  }>
  generatedAt: string
}

export function getBusinessHealth() {
  return http.get<BusinessHealthApi>('/dss/business-health', {
    timeoutMs: 15_000,
  })
}

