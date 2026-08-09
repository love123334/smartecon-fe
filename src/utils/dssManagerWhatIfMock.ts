/** Mock DSS — What-if Analysis: Promotion Scenario Comparison (Manager) */

export const MANAGER_CATEGORIES = [
  { value: 'electronics', label: 'Điện tử' },
  { value: 'fashion', label: 'Thời trang' },
  { value: 'coffee', label: 'Cà phê' },
  { value: 'beauty', label: 'Làm đẹp' },
] as const

export const CAMPAIGN_DURATIONS = [
  { value: '3' as const, label: '3 ngày' },
  { value: '7' as const, label: '7 ngày' },
  { value: '14' as const, label: '14 ngày' },
]

export type CampaignDurationKey = (typeof CAMPAIGN_DURATIONS)[number]['value']
export type InventoryRisk = 'low' | 'medium' | 'high' | 'very_high'

export interface PromoScenarioRow {
  discountPct: number
  predictedDemand: number
  revenue: number
  profit: number
  inventoryRisk: InventoryRisk
  inventoryRiskLabel: string
  recommendation: string
  isRecommended: boolean
  isBestBalance: boolean
}

export interface RadarScores {
  discountPct: number
  demandGrowth: number
  profit: number
  inventorySafety: number
}

export interface ManagerWhatIfResult {
  categoryLabel: string
  durationLabel: string
  rows: PromoScenarioRow[]
  recommendedDiscount: number
  recommendedReason: string
  insight: string
  radar: RadarScores[]
  generatedAt: string
}

const RISK_LABEL: Record<InventoryRisk, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  very_high: 'Rất cao',
}

/** Spec table for Coffee / 7 days */
const COFFEE_ROWS: Omit<PromoScenarioRow, 'inventoryRiskLabel'>[] = [
  {
    discountPct: 5,
    predictedDemand: 105,
    revenue: 2100,
    profit: 840,
    inventoryRisk: 'low',
    recommendation: 'Được khuyến nghị',
    isRecommended: true,
    isBestBalance: false,
  },
  {
    discountPct: 10,
    predictedDemand: 118,
    revenue: 2124,
    profit: 825,
    inventoryRisk: 'medium',
    recommendation: 'Cân bằng tốt nhất',
    isRecommended: false,
    isBestBalance: true,
  },
  {
    discountPct: 15,
    predictedDemand: 132,
    revenue: 2244,
    profit: 790,
    inventoryRisk: 'high',
    recommendation: '—',
    isRecommended: false,
    isBestBalance: false,
  },
  {
    discountPct: 20,
    predictedDemand: 150,
    revenue: 2400,
    profit: 720,
    inventoryRisk: 'very_high',
    recommendation: '—',
    isRecommended: false,
    isBestBalance: false,
  },
]

export function defaultManagerWhatIf(categoryLabel?: string): ManagerWhatIfResult {
  return generateManagerWhatIf({ category: 'coffee', categoryLabel, durationKey: '7' })
}

export function generateManagerWhatIf(input: {
  category: string
  categoryLabel?: string
  durationKey: CampaignDurationKey
}): ManagerWhatIfResult {
  const catLabel =
    input.categoryLabel
    ?? MANAGER_CATEGORIES.find((c) => c.value === input.category)?.label
    ?? input.category
  const duration = CAMPAIGN_DURATIONS.find((d) => d.value === input.durationKey) ?? CAMPAIGN_DURATIONS[1]

  // Slight variation by category/duration for demo feel; coffee+7 matches brief
  const factor =
    (input.category === 'coffee' ? 1 : input.category === 'electronics' ? 1.15 : 0.92) *
    (input.durationKey === '7' ? 1 : input.durationKey === '3' ? 0.85 : 1.2)

  const baseRows =
    input.category === 'coffee' && input.durationKey === '7'
      ? COFFEE_ROWS
      : COFFEE_ROWS.map((r) => ({
          ...r,
          predictedDemand: Math.round(r.predictedDemand * factor),
          revenue: Math.round(r.revenue * factor),
          profit: Math.round(r.profit * factor),
        }))

  const rows: PromoScenarioRow[] = baseRows.map((r) => ({
    ...r,
    inventoryRiskLabel: RISK_LABEL[r.inventoryRisk],
  }))

  const best = rows.find((r) => r.isBestBalance) ?? rows[1]

  const radar: RadarScores[] = rows.map((r) => ({
    discountPct: r.discountPct,
    demandGrowth: Math.min(100, Math.round(((r.predictedDemand - 100) / 50) * 100)),
    profit: Math.min(100, Math.round((r.profit / 840) * 100)),
    inventorySafety:
      r.inventoryRisk === 'low'
        ? 95
        : r.inventoryRisk === 'medium'
          ? 70
          : r.inventoryRisk === 'high'
            ? 40
            : 20,
  }))

  return {
    categoryLabel: catLabel,
    durationLabel: duration.label,
    rows,
    recommendedDiscount: best.discountPct,
    recommendedReason:
      'Mang lại sự cân bằng tốt nhất giữa tăng nhu cầu, giữ lợi nhuận và mức rủi ro tồn kho chấp nhận được.',
    insight:
      'Giảm giá khuyến mãi 10% dự kiến tăng nhu cầu khoảng 18% trong khi vẫn giữ biên lợi nhuận lành mạnh. Mức giảm trên 15% làm lợi nhuận giảm rõ và tăng đáng kể rủi ro thiếu hàng.',
    radar,
    generatedAt: new Date().toLocaleString('vi-VN'),
  }
}

export function formatUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}
