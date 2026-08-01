import { ApiError } from '@/api/http/client'

export const DISCOUNT_MIN = 1
export const DISCOUNT_MAX = 50
export const DISCOUNT_STEP = 1
export const SIMULATION_PERIOD_OPTIONS = [7, 14, 30, 60, 90] as const

export interface SellerWhatIfFormInput {
  productId: unknown
  discountPercentage: unknown
  simulationPeriod: unknown
}

export interface SellerWhatIfPayload {
  productId: number
  discountPercentage: number
  simulationPeriod: number
}

export interface SellerWhatIfFormErrors {
  productId?: string
  discountPercentage?: string
  simulationPeriod?: string
}

export type ProfitInsightBadge = 'INCREASE' | 'MAINTAIN' | 'DECREASE'

function toPositiveInt(value: unknown): number | null {
  if (value === '' || value == null) return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null
  return n
}

function toDiscountPercent(value: unknown): number | null {
  if (value === '' || value == null) return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0 || n >= 100) return null
  return n
}

export function validateSellerWhatIfForm(
  input: SellerWhatIfFormInput,
): { ok: true; payload: SellerWhatIfPayload } | { ok: false; errors: SellerWhatIfFormErrors } {
  const errors: SellerWhatIfFormErrors = {}
  const productId = toPositiveInt(input.productId)
  const discountPercentage = toDiscountPercent(input.discountPercentage)
  const simulationPeriod = toPositiveInt(input.simulationPeriod)

  if (productId == null) {
    errors.productId = 'Vui lòng chọn sản phẩm hợp lệ.'
  }
  if (discountPercentage == null) {
    errors.discountPercentage = 'Mức giảm giá phải lớn hơn 0% và nhỏ hơn 100%.'
  }
  if (simulationPeriod == null) {
    errors.simulationPeriod = 'Simulation Period phải là số nguyên dương.'
  }

  if (errors.productId || errors.discountPercentage || errors.simulationPeriod) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    payload: {
      productId: productId!,
      discountPercentage: discountPercentage!,
      simulationPeriod: simulationPeriod!,
    },
  }
}

export function formatVndCurrency(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—'
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatQuantity(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—'
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0,
  }).format(Math.round(n))
}

export function formatDiscountLabel(pct: number | string | null | undefined): string {
  const n = typeof pct === 'number' ? pct : Number(pct)
  if (!Number.isFinite(n)) return 'Giảm —%'
  return `Giảm ${n}%`
}

/**
 * Badge từ currentProfit / expectedProfit (±3%).
 * Không dựa vào chuỗi tiếng Việt.
 */
export function profitInsightBadge(
  currentProfit: number | string | null | undefined,
  expectedProfit: number | string | null | undefined,
): ProfitInsightBadge {
  const current = Number(currentProfit)
  const expected = Number(expectedProfit)
  if (!Number.isFinite(current) || !Number.isFinite(expected)) return 'MAINTAIN'

  if (current === 0) {
    if (expected > 0) return 'INCREASE'
    if (expected < 0) return 'DECREASE'
    return 'MAINTAIN'
  }

  const changePct = ((expected - current) / Math.abs(current)) * 100
  if (changePct > 3) return 'INCREASE'
  if (changePct < -3) return 'DECREASE'
  return 'MAINTAIN'
}

export function profitInsightBadgeLabel(badge: ProfitInsightBadge): string {
  if (badge === 'INCREASE') return 'INCREASE'
  if (badge === 'DECREASE') return 'DECREASE'
  return 'MAINTAIN'
}

export function mapSellerWhatIfError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return error.message || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    }
    if (error.status === 403) {
      return error.message || 'Bạn không có quyền phân tích sản phẩm này.'
    }
    if (error.status === 404) {
      return error.message || 'Không tìm thấy sản phẩm.'
    }
    if (error.status >= 500) {
      return error.message || 'Máy chủ gặp lỗi. Vui lòng thử lại sau.'
    }
    if (error.message?.trim()) return error.message
    return 'Không phân tích được kịch bản giảm giá.'
  }
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Không phân tích được kịch bản giảm giá.'
}
