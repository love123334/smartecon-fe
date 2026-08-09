import { getPlatformRevenueDashboard } from '@/api/real/platformRevenue'
import { todayIsoDate } from '@/utils/pricePrediction'
import { inclusiveDayCount } from '@/utils/platformRevenue'
import {
  CAMPAIGN_DURATIONS,
  type CampaignDurationKey,
  type InventoryRisk,
  type ManagerWhatIfResult,
  type PromoScenarioRow,
  type RadarScores,
} from '@/utils/dssManagerWhatIfMock'

const DISCOUNT_LEVELS = [5, 10, 15, 20] as const
/** Same default as backend DssAnalyticsService */
const ELASTICITY = -1.15
/** Category-level cost estimate when no per-SKU cost is aggregated */
const COST_RATIO = 0.68

const RISK_LABEL: Record<InventoryRisk, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  very_high: 'Rất cao',
}

function subtractDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() - days)
  return dt.toISOString().slice(0, 10)
}

function normName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function inventoryRisk(discountPct: number, demandGrowthPct: number): InventoryRisk {
  if (discountPct <= 5 || demandGrowthPct < 8) return 'low'
  if (discountPct <= 10 || demandGrowthPct < 18) return 'medium'
  if (discountPct <= 15 || demandGrowthPct < 28) return 'high'
  return 'very_high'
}

function buildScenario(
  discountPct: number,
  baselineDemand: number,
  avgPrice: number,
): Omit<PromoScenarioRow, 'inventoryRiskLabel' | 'recommendation' | 'isRecommended' | 'isBestBalance'> | null {
  const discountRate = discountPct / 100
  const newPrice = avgPrice * (1 - discountRate)
  const costPrice = avgPrice * COST_RATIO
  if (newPrice <= costPrice) return null

  const demandGrowthRate = ELASTICITY * -discountRate
  const predictedDemand = Math.max(0, Math.round(baselineDemand * (1 + demandGrowthRate)))
  const revenue = Math.round(newPrice * predictedDemand)
  const profit = Math.round((newPrice - costPrice) * predictedDemand)

  const demandGrowthPct =
    baselineDemand > 0 ? ((predictedDemand - baselineDemand) / baselineDemand) * 100 : 0
  const risk = inventoryRisk(discountPct, demandGrowthPct)

  return {
    discountPct,
    predictedDemand,
    revenue,
    profit,
    inventoryRisk: risk,
  }
}

function pickRecommendations(rows: PromoScenarioRow[]): {
  recommended: PromoScenarioRow
  bestBalance: PromoScenarioRow
} {
  const lowOrMedium = rows.filter((r) => r.inventoryRisk === 'low' || r.inventoryRisk === 'medium')
  const recommended =
    [...(lowOrMedium.length ? lowOrMedium : rows)].sort((a, b) => b.profit - a.profit)[0] ?? rows[0]

  const maxProfit = Math.max(...rows.map((r) => r.profit), 1)
  const scored = rows.map((r) => {
    const demandGrowth =
      rows[0].predictedDemand > 0
        ? ((r.predictedDemand - rows[0].predictedDemand) / rows[0].predictedDemand) * 100
        : 0
    const inventorySafety =
      r.inventoryRisk === 'low'
        ? 95
        : r.inventoryRisk === 'medium'
          ? 70
          : r.inventoryRisk === 'high'
            ? 40
            : 20
    const score = demandGrowth * 0.25 + (r.profit / maxProfit) * 100 * 0.55 + inventorySafety * 0.2
    return { row: r, score }
  })
  const bestBalance = scored.sort((a, b) => b.score - a.score)[0]?.row ?? recommended

  return { recommended, bestBalance }
}

function buildInsight(rows: PromoScenarioRow[], best: PromoScenarioRow): string {
  const baseline = rows[0]?.predictedDemand ?? 0
  const bestRow = rows.find((r) => r.discountPct === best.discountPct) ?? best
  const growthPct =
    baseline > 0 ? Math.round(((bestRow.predictedDemand - baseline) / baseline) * 100) : 0
  const heavy = rows.find((r) => r.discountPct >= 15)
  const heavyProfitDrop =
    heavy && rows[0] ? Math.round(((rows[0].profit - heavy.profit) / Math.max(rows[0].profit, 1)) * 100) : 0

  return (
    `Giảm giá ${best.discountPct}% dự kiến tăng nhu cầu khoảng ${growthPct}% trong khi vẫn giữ biên lợi nhuận chấp nhận được. ` +
    (heavyProfitDrop > 0
      ? `Mức giảm từ 15% trở lên có thể làm lợi nhuận giảm ~${heavyProfitDrop}% và tăng rủi ro thiếu hàng.`
      : 'Theo dõi tồn kho khi triển khai chiến dịch dài ngày.')
  )
}

export async function fetchManagerWhatIf(input: {
  categoryLabel: string
  durationKey: CampaignDurationKey
}): Promise<ManagerWhatIfResult> {
  const duration =
    CAMPAIGN_DURATIONS.find((d) => d.value === input.durationKey) ?? CAMPAIGN_DURATIONS[1]
  const durationDays = Number(input.durationKey)

  const toDate = todayIsoDate()
  const fromDate = subtractDays(toDate, 89)

  const dashboard = await getPlatformRevenueDashboard({
    fromDate,
    toDate,
    granularity: 'DAY',
    topLimit: 20,
  })

  const categories = dashboard.topCategories ?? []
  const targetNorm = normName(input.categoryLabel)
  const category =
    categories.find((c) => c.categoryName && normName(c.categoryName) === targetNorm) ??
    categories.find((c) => c.categoryName && normName(c.categoryName).includes(targetNorm)) ??
    categories.find((c) => c.categoryName && targetNorm.includes(normName(c.categoryName))) ??
    categories[0]

  if (!category?.unitsSold || category.unitsSold <= 0) {
    throw new Error(
      `Không đủ dữ liệu bán hàng cho danh mục "${input.categoryLabel}" trong 90 ngày gần đây.`,
    )
  }

  const periodDays = inclusiveDayCount(fromDate, toDate)
  const baselineDemand = Math.max(
    1,
    Math.round((category.unitsSold * durationDays) / Math.max(periodDays, 1)),
  )
  const avgPrice = category.grossMerchandiseValue / category.unitsSold

  const rawRows = DISCOUNT_LEVELS.map((pct) => buildScenario(pct, baselineDemand, avgPrice)).filter(
    (r): r is NonNullable<typeof r> => r != null,
  )

  if (!rawRows.length) {
    throw new Error('Không tính được kịch bản — giá vốn ước tính quá cao so với mức giảm.')
  }

  const { recommended, bestBalance } = pickRecommendations(
    rawRows.map((r) => ({
      ...r,
      inventoryRiskLabel: RISK_LABEL[r.inventoryRisk],
      recommendation: '—',
      isRecommended: false,
      isBestBalance: false,
    })),
  )

  const rows: PromoScenarioRow[] = rawRows.map((r) => ({
    ...r,
    inventoryRiskLabel: RISK_LABEL[r.inventoryRisk],
    recommendation:
      r.discountPct === recommended.discountPct
        ? 'Được khuyến nghị'
        : r.discountPct === bestBalance.discountPct
          ? 'Cân bằng tốt nhất'
          : '—',
    isRecommended: r.discountPct === recommended.discountPct,
    isBestBalance: r.discountPct === bestBalance.discountPct,
  }))

  const baselineProfit = rows[0]?.profit ?? 1
  const radar: RadarScores[] = rows.map((r) => ({
    discountPct: r.discountPct,
    demandGrowth: Math.min(
      100,
      Math.round(((r.predictedDemand - baselineDemand) / Math.max(baselineDemand, 1)) * 100),
    ),
    profit: Math.min(100, Math.round((r.profit / Math.max(baselineProfit, 1)) * 100)),
    inventorySafety:
      r.inventoryRisk === 'low'
        ? 95
        : r.inventoryRisk === 'medium'
          ? 70
          : r.inventoryRisk === 'high'
            ? 40
            : 20,
  }))

  const catLabel = category.categoryName ?? input.categoryLabel

  return {
    categoryLabel: catLabel,
    durationLabel: duration.label,
    rows,
    recommendedDiscount: bestBalance.discountPct,
    recommendedReason:
      'Mang lại sự cân bằng tốt nhất giữa tăng nhu cầu, giữ lợi nhuận và mức rủi ro tồn kho chấp nhận được — tính từ GMV và số lượng bán thực tế của danh mục.',
    insight: buildInsight(rows, bestBalance),
    radar,
    generatedAt: new Date().toLocaleString('vi-VN'),
  }
}
