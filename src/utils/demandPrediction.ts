import { ApiError } from '@/api/http/client'

export const HISTORICAL_DAYS_OPTIONS = [30, 60, 90, 180] as const
export const FORECAST_PERIOD_OPTIONS = [7, 14, 30, 60] as const

export interface DemandPredictionFormInput {
  productId: unknown
  historicalDays: unknown
  forecastPeriod: unknown
}

export interface DemandPredictionPayload {
  productId: number
  historicalDays: number
  forecastPeriod: number
}

export interface DemandPredictionFormErrors {
  productId?: string
  historicalDays?: string
  forecastPeriod?: string
}

function toPositiveInt(value: unknown): number | null {
  if (value === '' || value == null) return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null
  return n
}

export function validateDemandPredictionForm(
  input: DemandPredictionFormInput,
): { ok: true; payload: DemandPredictionPayload } | { ok: false; errors: DemandPredictionFormErrors } {
  const errors: DemandPredictionFormErrors = {}
  const productId = toPositiveInt(input.productId)
  const historicalDays = toPositiveInt(input.historicalDays)
  const forecastPeriod = toPositiveInt(input.forecastPeriod)

  if (productId == null) {
    errors.productId = 'Vui lòng chọn sản phẩm hợp lệ.'
  }
  if (historicalDays == null) {
    errors.historicalDays = 'Historical Days phải là số nguyên dương.'
  }
  if (forecastPeriod == null) {
    errors.forecastPeriod = 'Forecast Period phải là số nguyên dương.'
  }

  if (errors.productId || errors.historicalDays || errors.forecastPeriod) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    payload: {
      productId: productId!,
      historicalDays: historicalDays!,
      forecastPeriod: forecastPeriod!,
    },
  }
}

export function formatViNumber(value: number | string | null | undefined): string {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
}

export function formatViDateTime(value: string | null | undefined): string {
  if (value == null || String(value).trim() === '') return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date)
}

export function mapDemandPredictionError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return error.message || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    }
    if (error.status === 403) {
      return error.message || 'Bạn không có quyền tạo dự báo cho sản phẩm này.'
    }
    if (error.message?.trim()) return error.message
    return 'Không tạo được dự báo nhu cầu.'
  }
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Không tạo được dự báo nhu cầu.'
}
