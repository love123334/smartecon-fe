import { ApiError } from '@/api/http/client'

export const PRICE_CHANGE_MIN = -300
export const PRICE_CHANGE_MAX = 300
export const PRICE_CHANGE_STEP = 1
export const SIMULATION_PERIOD_OPTIONS = [7, 14, 30, 60, 90] as const

export interface SellerWhatIfFormInput {
  productId: unknown
  priceChangePercent: unknown
  simulationPeriod: unknown
}

export interface SellerWhatIfPayload {
  productId: number
  priceChangePercent: number
  simulationPeriod: number
}

export interface SellerWhatIfFormErrors {
  productId?: string
  priceChangePercent?: string
  simulationPeriod?: string
}

export type ProfitInsightBadge = 'INCREASE' | 'MAINTAIN' | 'DECREASE'

function toPositiveInt(value: unknown): number | null {
  if (value === '' || value == null) return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null
  return n
}

function toPriceChangePercent(value: unknown): number | null {
  if (value === '' || value == null) return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < PRICE_CHANGE_MIN || n > PRICE_CHANGE_MAX) return null
  return n
}

export function validateSellerWhatIfForm(
  input: SellerWhatIfFormInput,
): { ok: true; payload: SellerWhatIfPayload } | { ok: false; errors: SellerWhatIfFormErrors } {
  const errors: SellerWhatIfFormErrors = {}
  const productId = toPositiveInt(input.productId)
  const priceChangePercent = toPriceChangePercent(input.priceChangePercent)
  const simulationPeriod = toPositiveInt(input.simulationPeriod)

  if (productId == null) {
    errors.productId = 'Vui lòng chọn sản phẩm hợp lệ.'
  }
  if (priceChangePercent == null) {
    errors.priceChangePercent = `Mức thay đổi giá phải từ ${PRICE_CHANGE_MIN}% đến ${PRICE_CHANGE_MAX}%.`
  }
  if (simulationPeriod == null) {
    errors.simulationPeriod = 'Kỳ dự báo phải là số nguyên dương.'
  }

  if (errors.productId || errors.priceChangePercent || errors.simulationPeriod) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    payload: {
      productId: productId!,
      priceChangePercent: priceChangePercent!,
      simulationPeriod: simulationPeriod!,
    },
  }
}

/** Nhãn hiển thị: 0 = giữ giá, âm = giảm, dương = tăng */
export function formatPriceChangeLabel(pct: number | string | null | undefined): string {
  const n = typeof pct === 'number' ? pct : Number(pct)
  if (!Number.isFinite(n)) return 'Giữ giá (0%)'
  if (n === 0) return 'Giữ giá (0%)'
  if (n < 0) return `Giảm ${Math.abs(n)}%`
  return `Tăng ${n}%`
}

/** @deprecated dùng formatPriceChangeLabel */
export function formatDiscountLabel(pct: number | string | null | undefined): string {
  const n = typeof pct === 'number' ? pct : Number(pct)
  if (!Number.isFinite(n)) return 'Giảm —%'
  if (n <= 0) return formatPriceChangeLabel(n)
  return `Giảm ${n}%`
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
  if (badge === 'INCREASE') return 'Tăng'
  if (badge === 'DECREASE') return 'Giảm'
  return 'Ổn định'
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
    return 'Không phân tích được kịch bản giá.'
  }
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Không phân tích được kịch bản giá.'
}
