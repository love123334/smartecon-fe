import { ApiError } from '@/api/http/client'
import type { PriceScenarioApi } from '@/api/real/dss'

export interface PricePredictionFormInput {
  productId: unknown
  fromDate: unknown
  toDate: unknown
}

export interface PricePredictionPayload {
  productId: number
  fromDate: string
  toDate: string
}

export interface PricePredictionFormErrors {
  productId?: string
  fromDate?: string
  toDate?: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function toPositiveInt(value: unknown): number | null {
  if (value === '' || value == null) return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null
  return n
}

function parseIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!DATE_RE.test(trimmed)) return null
  const [y, m, d] = trimmed.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null
  }
  return trimmed
}

/** Local calendar today as YYYY-MM-DD */
export function todayIsoDate(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function defaultPriceRange(now = new Date()): { fromDate: string; toDate: string } {
  const toDate = todayIsoDate(now)
  const from = new Date(now)
  // Backend needs ≥2 price regimes in range; seed/demo history spans ~90 days.
  from.setDate(from.getDate() - 89)
  return { fromDate: todayIsoDate(from), toDate }
}

export function validatePricePredictionForm(
  input: PricePredictionFormInput,
  now = new Date(),
): { ok: true; payload: PricePredictionPayload } | { ok: false; errors: PricePredictionFormErrors } {
  const errors: PricePredictionFormErrors = {}
  const productId = toPositiveInt(input.productId)
  const fromDate = parseIsoDate(input.fromDate)
  const toDate = parseIsoDate(input.toDate)
  const today = todayIsoDate(now)

  if (productId == null) {
    errors.productId = 'Vui lòng chọn sản phẩm hợp lệ.'
  }
  if (!fromDate) {
    errors.fromDate = 'From Date phải có định dạng YYYY-MM-DD.'
  }
  if (!toDate) {
    errors.toDate = 'To Date phải có định dạng YYYY-MM-DD.'
  }

  if (fromDate && toDate && fromDate > toDate) {
    errors.fromDate = 'From Date không được lớn hơn To Date.'
  }
  if (toDate && toDate > today) {
    errors.toDate = 'To Date không được thuộc tương lai.'
  }

  if (errors.productId || errors.fromDate || errors.toDate) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    payload: {
      productId: productId!,
      fromDate: fromDate!,
      toDate: toDate!,
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

export function formatSignedPercent(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—'
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n}%`
}

export function formatElasticity(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—'
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(n)
}

export function formatQuantity(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—'
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0,
  }).format(n)
}

export function scenarioTone(
  pct: number | null | undefined,
): 'decrease' | 'keep' | 'increase' {
  const n = Number(pct)
  if (!Number.isFinite(n) || n === 0) return 'keep'
  return n < 0 ? 'decrease' : 'increase'
}

export function scenarioToneLabel(tone: 'decrease' | 'keep' | 'increase'): string {
  if (tone === 'decrease') return 'Giảm giá'
  if (tone === 'increase') return 'Tăng giá'
  return 'Giữ giá'
}

/** Match best row by backend bestScenario.priceChangePercent (source of truth). */
export function isBestScenarioRow(
  row: PriceScenarioApi,
  best: PriceScenarioApi | null | undefined,
): boolean {
  if (!best) return false
  return Number(row.priceChangePercent) === Number(best.priceChangePercent)
}

export function normalizeScenarios(
  scenarios: PriceScenarioApi[] | null | undefined,
): PriceScenarioApi[] {
  if (!Array.isArray(scenarios)) return []
  return scenarios.filter((s) => s != null)
}

export function mapPricePredictionError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return error.message || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    }
    if (error.status === 403) {
      return error.message || 'Bạn không có quyền tạo khuyến nghị giá cho sản phẩm này.'
    }
    if (error.status === 404) {
      return error.message || 'Không tìm thấy sản phẩm.'
    }
    if (error.status >= 500) {
      return error.message || 'Máy chủ gặp lỗi. Vui lòng thử lại sau.'
    }
    if (error.message?.trim()) return error.message
    return 'Không tạo được khuyến nghị giá.'
  }
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Không tạo được khuyến nghị giá.'
}
