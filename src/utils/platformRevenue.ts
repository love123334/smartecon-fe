import { ApiError } from '@/api/http/client'
import type {
  PlatformRevenueDashboardQuery,
  RevenueGranularity,
} from '@/api/real/platformRevenue'
import { todayIsoDate } from '@/utils/pricePrediction'

export const TOP_LIMIT_OPTIONS = [5, 10, 15, 20] as const
export const GRANULARITY_OPTIONS: RevenueGranularity[] = ['DAY', 'MONTH']
export const MAX_RANGE_DAYS = 366

export interface PlatformRevenueFilterErrors {
  fromDate?: string
  toDate?: string
  range?: string
  granularity?: string
  topLimit?: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const ORDER_STATUS_VI: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  PAID: 'Đã thanh toán',
  PROCESSING: 'Đang xử lý',
  SHIPPING: 'Đang giao',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
  REFUNDED: 'Đã hoàn tiền',
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

/** Inclusive day count between two YYYY-MM-DD dates. */
export function inclusiveDayCount(fromDate: string, toDate: string): number {
  const a = Date.UTC(
    Number(fromDate.slice(0, 4)),
    Number(fromDate.slice(5, 7)) - 1,
    Number(fromDate.slice(8, 10)),
  )
  const b = Date.UTC(
    Number(toDate.slice(0, 4)),
    Number(toDate.slice(5, 7)) - 1,
    Number(toDate.slice(8, 10)),
  )
  return Math.floor((b - a) / 86_400_000) + 1
}

export function defaultPlatformRevenueFilter(now = new Date()): PlatformRevenueDashboardQuery {
  const toDate = todayIsoDate(now)
  const from = new Date(now)
  from.setDate(from.getDate() - 29)
  return {
    fromDate: todayIsoDate(from),
    toDate,
    granularity: 'DAY',
    topLimit: 5,
  }
}

export function validatePlatformRevenueFilter(
  input: {
    fromDate: unknown
    toDate: unknown
    granularity: unknown
    topLimit: unknown
  },
  now = new Date(),
):
  | { ok: true; query: PlatformRevenueDashboardQuery }
  | { ok: false; errors: PlatformRevenueFilterErrors } {
  const errors: PlatformRevenueFilterErrors = {}
  const fromDate = parseIsoDate(input.fromDate)
  const toDate = parseIsoDate(input.toDate)
  const today = todayIsoDate(now)
  const granularity = String(input.granularity ?? '') as RevenueGranularity
  const topLimit = Number(input.topLimit)

  if (!fromDate) errors.fromDate = 'From Date phải có định dạng YYYY-MM-DD.'
  if (!toDate) errors.toDate = 'To Date phải có định dạng YYYY-MM-DD.'
  if (granularity !== 'DAY' && granularity !== 'MONTH') {
    errors.granularity = 'Granularity phải là DAY hoặc MONTH.'
  }
  if (!Number.isInteger(topLimit) || topLimit < 1 || topLimit > 20) {
    errors.topLimit = 'Top Limit phải từ 1 đến 20.'
  }

  if (fromDate && toDate && fromDate > toDate) {
    errors.fromDate = 'From Date không được sau To Date.'
  }
  if (toDate && toDate > today) {
    errors.toDate = 'To Date không được ở tương lai.'
  }
  if (fromDate && toDate && fromDate <= toDate) {
    const days = inclusiveDayCount(fromDate, toDate)
    if (days > MAX_RANGE_DAYS) {
      errors.range = `Khoảng thời gian không được vượt quá ${MAX_RANGE_DAYS} ngày.`
    }
  }

  if (
    errors.fromDate ||
    errors.toDate ||
    errors.range ||
    errors.granularity ||
    errors.topLimit
  ) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    query: {
      fromDate: fromDate!,
      toDate: toDate!,
      granularity,
      topLimit,
    },
  }
}

export function formatPlatformVnd(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—'
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatPlatformNumber(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—'
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n)
}

export function formatPlatformPercent(
  value: number | string | null | undefined,
  opts?: { signed?: boolean },
): string {
  if (value == null || value === '') return '—'
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return '—'
  const body = new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
  if (opts?.signed && n > 0) return `+${body}%`
  return `${body}%`
}

export function formatGeneratedAt(value: string | null | undefined): string {
  if (value == null || String(value).trim() === '') return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date)
}

export function formatPeriodLabel(periodStart: string, granularity: RevenueGranularity): string {
  if (!periodStart) return '—'
  if (granularity === 'MONTH') {
    const m = periodStart.slice(0, 7)
    return m || periodStart
  }
  return periodStart
}

export function orderStatusDisplayLabel(status: string): string {
  const key = String(status ?? '').toUpperCase()
  return ORDER_STATUS_VI[key] ?? status
}

export function paymentMethodLabel(method: string): string {
  const key = String(method ?? '').toUpperCase()
  if (key === 'VNPAY') return 'VNPay'
  if (key === 'MOMO') return 'MoMo'
  if (key === 'COD') return 'COD'
  return method
}

export function categoryDisplayName(
  categoryId: number | null | undefined,
  categoryName: string | null | undefined,
): string {
  if (categoryId == null && (!categoryName || !String(categoryName).trim())) {
    return 'Uncategorized'
  }
  if (!categoryName || !String(categoryName).trim()) return 'Uncategorized'
  return categoryName
}

export function mapPlatformRevenueError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return error.message || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    }
    if (error.status === 403) {
      return error.message || 'Bạn không có quyền xem báo cáo doanh thu toàn sàn.'
    }
    if (error.status === 404) {
      return (
        error.message ||
        'Backend này chưa có API doanh thu sàn. Bạn vẫn xem được Looker Studio phía trên.'
      )
    }
    if (error.status >= 500) {
      const raw = error.message || ''
      if (/exponential mark|BigDecimal|Character array/i.test(raw)) {
        return 'Lỗi xử lý số liệu báo cáo trên máy chủ. Vui lòng thử lại sau khi hệ thống cập nhật.'
      }
      return raw || 'Máy chủ gặp lỗi. Vui lòng thử lại sau.'
    }
    if (error.message?.trim()) {
      if (/exponential mark|BigDecimal|Character array/i.test(error.message)) {
        return 'Lỗi xử lý số liệu báo cáo. Vui lòng thử lại.'
      }
      return error.message
    }
    return 'Không tải được báo cáo doanh thu toàn sàn.'
  }
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Không tải được báo cáo doanh thu toàn sàn.'
}

export const GMV_TOOLTIP =
  'GMV là tổng giá trị hàng hóa của các đơn hiện đang ở trạng thái đã giao; đây không phải doanh thu thuần hoặc lợi nhuận của nền tảng.'
