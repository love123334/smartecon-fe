/** Mock DSS — Khuyến nghị bổ sung tồn kho (FE demo) */

export interface InventoryProductOption {
  id: string
  name: string
  /** Dùng để demo lỗi "không đủ dữ liệu" */
  insufficient?: boolean
}

export const INVENTORY_PRODUCTS: InventoryProductOption[] = [
  { id: 'a', name: 'Tai nghe Bluetooth Pro ANC' },
  { id: 'b', name: 'Bàn phím cơ RGB KeyPro K87' },
  { id: 'c', name: 'Nồi chiên không dầu 5L' },
  { id: 'all', name: 'Tất cả sản phẩm (demo)' },
  { id: 'x', name: 'Sản phẩm thiếu dữ liệu (demo lỗi)', insufficient: true },
]

export type PlanningPeriodKey = '7' | '14' | '30'

export const PLANNING_PERIOD_OPTIONS = [
  { value: '7' as const, label: '7 ngày', days: 7 },
  { value: '14' as const, label: '14 ngày', days: 14 },
  { value: '30' as const, label: '30 ngày', days: 30 },
]

export type ReplenishStatus = 'need' | 'sufficient'

export interface InventoryRow {
  productId: string
  productName: string
  currentStock: number
  averageDailyDemand: number
  leadTimeDays: number
  safetyStock: number
  reorderPoint: number
  recommendedOrder: number
  status: ReplenishStatus
  statusLabel: string
  historicalSales: { day: number; qty: number }[]
}

export interface InventoryRecommendationResult {
  planningLabel: string
  planningDays: number
  focusProductName: string
  currentStock: number
  averageDailyDemand: number
  reorderPoint: number
  recommendedOrderQuantity: number
  overallStatus: ReplenishStatus
  overallStatusLabel: string
  recommendationMessage: string
  rows: InventoryRow[]
  generatedAt: string
}

export type InventoryErrorCode = 'insufficient' | 'not_found' | 'failed'

const DEMO_BASE: Omit<InventoryRow, 'historicalSales' | 'statusLabel'>[] = [
  {
    productId: 'a',
    productName: 'Tai nghe Bluetooth Pro ANC',
    currentStock: 80,
    averageDailyDemand: 5,
    leadTimeDays: 7,
    safetyStock: 20,
    reorderPoint: 55,
    recommendedOrder: 90,
    status: 'need',
  },
  {
    productId: 'b',
    productName: 'Bàn phím cơ RGB KeyPro K87',
    currentStock: 160,
    averageDailyDemand: 4,
    leadTimeDays: 7,
    safetyStock: 20,
    reorderPoint: 48,
    recommendedOrder: 0,
    status: 'sufficient',
  },
  {
    productId: 'c',
    productName: 'Nồi chiên không dầu 5L',
    currentStock: 45,
    averageDailyDemand: 6,
    leadTimeDays: 7,
    safetyStock: 20,
    reorderPoint: 62,
    recommendedOrder: 155,
    status: 'need',
  },
]

function salesSeries(add: number, seed: number): { day: number; qty: number }[] {
  const base = [4, 5, 6, 5, 7, 4, 5, 6, 5, 4, 6, 5, 7, 5]
  return base.map((q, i) => ({
    day: i + 1,
    qty: Math.max(1, q + ((seed * (i + 2)) % 3) - 1 + Math.round(add - 5)),
  }))
}

function withMeta(row: (typeof DEMO_BASE)[0]): InventoryRow {
  return {
    ...row,
    statusLabel: row.status === 'need' ? 'Cần bổ sung' : 'Tồn kho đủ',
    historicalSales: salesSeries(row.averageDailyDemand, Number(row.productId.charCodeAt(0))),
  }
}

export function generateInventoryRecommendation(input: {
  productId: string
  planningKey: PlanningPeriodKey
}): { ok: true; data: InventoryRecommendationResult } | { ok: false; error: InventoryErrorCode } {
  const planning = PLANNING_PERIOD_OPTIONS.find((o) => o.value === input.planningKey)!
  const product = INVENTORY_PRODUCTS.find((p) => p.id === input.productId)

  if (!product) {
    return { ok: false, error: 'not_found' }
  }
  if (product.insufficient) {
    return { ok: false, error: 'insufficient' }
  }

  const allRows = DEMO_BASE.map(withMeta)
  const rows =
    input.productId === 'all'
      ? allRows
      : allRows.filter((r) => r.productId === input.productId)

  if (!rows.length) {
    return { ok: false, error: 'failed' }
  }

  const focus = rows[0]
  const needAny = rows.some((r) => r.status === 'need')
  const overallStatus: ReplenishStatus = needAny ? 'need' : 'sufficient'
  const overallStatusLabel = needAny ? 'Cần bổ sung' : 'Tồn kho đủ'

  const recommendationMessage = needAny
    ? `Tồn kho hiện tại của một số sản phẩm đang thấp hơn điểm đặt hàng lại (ROP). Nên bổ sung hàng trong kỳ hoạch định ${planning.label}.`
    : `Tồn kho hiện tại đủ so với điểm đặt hàng lại trong kỳ ${planning.label}. Chưa cần nhập thêm.`

  return {
    ok: true,
    data: {
      planningLabel: planning.label,
      planningDays: planning.days,
      focusProductName: input.productId === 'all' ? 'Tất cả sản phẩm (demo)' : focus.productName,
      currentStock: focus.currentStock,
      averageDailyDemand: focus.averageDailyDemand,
      reorderPoint: focus.reorderPoint,
      recommendedOrderQuantity: focus.recommendedOrder,
      overallStatus,
      overallStatusLabel,
      recommendationMessage,
      rows,
      generatedAt: new Date().toLocaleString('vi-VN'),
    },
  }
}

export const INVENTORY_ERROR_MESSAGES: Record<InventoryErrorCode, string> = {
  insufficient: 'Không đủ dữ liệu tồn kho để phân tích.',
  not_found: 'Không tìm thấy sản phẩm.',
  failed: 'Không thể tạo khuyến nghị tồn kho.',
}
