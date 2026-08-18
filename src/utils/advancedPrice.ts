import { ApiError } from '@/api/http/client'
import type { CreateAdvancedPriceSessionRequest } from '@/api/real/dss'

export const ADVANCED_PRICE_CHANGE_MIN = -70
export const ADVANCED_PRICE_CHANGE_MAX = 100
export const ADVANCED_PRICE_CHANGE_STEP = 1
export const ADVANCED_PRICE_FORECAST_PERIODS = [7, 14, 30] as const

export interface AdvancedPriceFormInput {
  productId: number | ''
  fromDate: string
  toDate: string
  forecastPeriod: number
  estimatedOrderCost: number | null
}

export interface AdvancedPriceFieldErrors {
  productId?: string
  fromDate?: string
  toDate?: string
  forecastPeriod?: string
  estimatedOrderCost?: string
  priceChangePercent?: string
}

type ValidationResult =
  | { ok: true; payload: CreateAdvancedPriceSessionRequest }
  | { ok: false; errors: AdvancedPriceFieldErrors }

function isoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function advancedPriceDateDefaults(): { fromDate: string; toDate: string } {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 29)
  return { fromDate: isoDate(from), toDate: isoDate(to) }
}

export function todayIsoDate(): string {
  return isoDate(new Date())
}

function inclusiveDays(fromDate: string, toDate: string): number {
  const from = Date.parse(`${fromDate}T00:00:00Z`)
  const to = Date.parse(`${toDate}T00:00:00Z`)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0
  return Math.floor((to - from) / 86_400_000) + 1
}

export function validateAdvancedPriceForm(input: AdvancedPriceFormInput): ValidationResult {
  const errors: AdvancedPriceFieldErrors = {}
  const productId = Number(input.productId)
  if (!Number.isInteger(productId) || productId <= 0) {
    errors.productId = 'Vui lòng chọn sản phẩm của bạn.'
  }
  if (!input.fromDate) errors.fromDate = 'Vui lòng chọn ngày bắt đầu.'
  if (!input.toDate) errors.toDate = 'Vui lòng chọn ngày kết thúc.'

  if (input.fromDate && input.toDate) {
    const days = inclusiveDays(input.fromDate, input.toDate)
    if (days <= 0) {
      errors.toDate = 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.'
    } else if (days < 7 || days > 180) {
      errors.toDate = 'Khoảng dữ liệu lịch sử phải từ 7 đến 180 ngày.'
    }
    if (input.toDate > todayIsoDate()) {
      errors.toDate = 'Ngày kết thúc không được ở tương lai.'
    }
  }

  if (!ADVANCED_PRICE_FORECAST_PERIODS.includes(input.forecastPeriod as 7 | 14 | 30)) {
    errors.forecastPeriod = 'Khoảng dự báo chỉ nhận 7, 14 hoặc 30 ngày.'
  }

  const orderCost = Number(input.estimatedOrderCost)
  if (!Number.isFinite(orderCost) || orderCost < 0) {
    errors.estimatedOrderCost = 'Chi phí phải là số lớn hơn hoặc bằng 0.'
  }

  if (Object.keys(errors).length) return { ok: false, errors }

  return {
    ok: true,
    payload: {
      productId,
      fromDate: input.fromDate,
      toDate: input.toDate,
      forecastPeriod: input.forecastPeriod as 7 | 14 | 30,
      estimatedOrderCost: orderCost,
    },
  }
}

export function validateAdvancedPriceChange(value: number): string {
  if (!Number.isFinite(value)) return 'Vui lòng chọn phần trăm đổi giá.'
  if (value < ADVANCED_PRICE_CHANGE_MIN || value > ADVANCED_PRICE_CHANGE_MAX) {
    return 'Phần trăm đổi giá phải nằm trong khoảng -70% đến +100%.'
  }
  return ''
}

export function formatVnd(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(
    Number(value) || 0,
  )
}

export function formatSignedPercent(value: number): string {
  const numeric = Number(value) || 0
  return `${numeric > 0 ? '+' : ''}${formatNumber(numeric)}%`
}

export function formatForecastMethod(method: string): string {
  if (method === 'lightgbm_onnx') return 'Mô hình học máy'
  if (method === 'lightgbm_onnx_with_baseline_fallback') {
    return 'Mô hình học máy · có dùng dự phòng'
  }
  if (method === 'trend_blended_feature_forecast') return 'Dự báo xu hướng dự phòng'
  return method || 'Không xác định'
}

export function mapAdvancedPriceError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    if (error.status === 403) return 'Bạn không có quyền thao tác với sản phẩm hoặc phiên này.'
    if (error.status === 404) return 'Phiên hoặc kịch bản không còn tồn tại.'
    if (error.message) return error.message
  }
  return error instanceof Error
    ? error.message
    : 'Không thể xử lý kịch bản giá. Vui lòng thử lại.'
}

