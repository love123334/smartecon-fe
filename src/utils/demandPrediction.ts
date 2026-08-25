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

export type DemandAiTone = 'strong' | 'steady' | 'soft' | 'sparse'

export interface DemandAiInsight {
  tone: DemandAiTone
  badge: string
  title: string
  summary: string
  actions: string[]
  risks: string[]
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
    errors.historicalDays = 'Số ngày lịch sử phải là số nguyên dương.'
  }
  if (forecastPeriod == null) {
    errors.forecastPeriod = 'Kỳ dự báo phải là số nguyên dương.'
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

/** ISO date (YYYY-MM-DD) → dd/MM/yyyy (padded, khớp trục biểu đồ DSS). */
export function formatIsoDateVi(value: string | null | undefined): string {
  if (value == null || String(value).trim() === '') return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value).trim())
  if (!match) return ''
  return `${match[3]}/${match[2]}/${match[1]}`
}

/** ISO date (YYYY-MM-DD) → dd/MM/yyyy */
export function formatViDate(value: string | null | undefined): string {
  const padded = formatIsoDateVi(value)
  return padded || '—'
}

export function mapDemandPredictionError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return error.message || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    }
    if (error.status === 403) {
      return 'Sản phẩm này không thuộc shop của bạn. Chọn lại SP trong danh sách shop.'
    }
    if (/does not belong to current seller/i.test(error.message || '')) {
      return 'Sản phẩm này không thuộc shop của bạn. Chọn lại SP trong danh sách shop.'
    }
    if (error.message?.trim()) return error.message
    return 'Không tạo được dự báo nhu cầu.'
  }
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Không tạo được dự báo nhu cầu.'
}

/** Phân loại mức nhu cầu để gắn tone nhận định AI. */
export function classifyDemandTone(averageDailyDemand: number): DemandAiTone {
  const avg = Number(averageDailyDemand)
  if (!Number.isFinite(avg) || avg <= 0) return 'sparse'
  if (avg >= 8) return 'strong'
  if (avg >= 3) return 'steady'
  if (avg >= 0.8) return 'soft'
  return 'sparse'
}

/**
 * Nhận định AI cục bộ từ kết quả Moving Average —
 * giải thích số liệu và đề xuất hành động cho seller.
 */
export function buildDemandPredictionAiInsight(input: {
  productName: string
  historicalDays: number
  forecastPeriod: number
  averageDailyDemand: number
  predictedDemand: number
}): DemandAiInsight {
  const name = (input.productName || 'Sản phẩm').trim() || 'Sản phẩm'
  const hist = Math.max(1, Number(input.historicalDays) || 1)
  const period = Math.max(1, Number(input.forecastPeriod) || 1)
  const avg = Number(input.averageDailyDemand)
  const total = Number(input.predictedDemand)
  const safeAvg = Number.isFinite(avg) ? avg : 0
  const safeTotal = Number.isFinite(total) ? total : safeAvg * period
  const tone = classifyDemandTone(safeAvg)
  const avgLabel = formatViNumber(safeAvg)
  const totalLabel = formatViNumber(safeTotal)

  const base = {
    strong: {
      badge: 'Nhu cầu cao',
      title: `${name} đang có tín hiệu bán mạnh`,
      summary: `Trung bình ${avgLabel} sản phẩm/ngày trên ${hist} ngày gần đây → dự báo ${totalLabel} sản phẩm trong ${period} ngày tới (Moving Average). SKU này nên được ưu tiên tồn kho và theo dõi hết hàng.`,
      actions: [
        `Chủ động nhập thêm ít nhất ~${totalLabel} sản phẩm cho kỳ ${period} ngày (đã gồm buffer vận hành).`,
        'Kiểm tra Khuyến nghị tồn kho để đối chiếu ROP / safety stock.',
        'Tránh tăng giá đột ngột trước khi chạy Gợi ý giá / What-if.',
      ],
      risks: [
        'Hết hàng giữa kỳ làm mất doanh thu và xếp hạng shop.',
        'Lead time nhà cung cấp dài hơn dự kiến sẽ “khoét” buffer tồn.',
      ],
    },
    steady: {
      badge: 'Nhu cầu ổn định',
      title: `${name} duy trì nhịp bán đều`,
      summary: `Nhu cầu TB ${avgLabel}/ngày → khoảng ${totalLabel} sản phẩm/${period} ngày. Mức này phù hợp duy trì tồn xoay vòng và tối ưu vốn.`,
      actions: [
        `Lên kế hoạch nhập theo nhịp ~${avgLabel}/ngày, tránh tồn quá dày.`,
        'Dùng What-if giảm giá nếu muốn kích cầu nhẹ mà vẫn giữ biên lợi nhuận.',
        'Theo dõi lại dự báo sau mỗi chu kỳ khuyến mãi.',
      ],
      risks: [
        'Khuyến mãi đột xuất có thể làm nhu cầu thực tế lệch khỏi Moving Average.',
        'Tồn dư nếu nhập quá xa so với dự báo.',
      ],
    },
    soft: {
      badge: 'Nhu cầu vừa phải',
      title: `${name} bán chậm hơn nhóm hot`,
      summary: `TB ${avgLabel}/ngày → dự báo ${totalLabel} sản phẩm trong ${period} ngày. Có thể đẩy cầu bằng giá / bundle, nhưng cần kiểm soát chi phí khuyến mãi.`,
      actions: [
        'Chạy Gợi ý giá để xem có nên giảm nhẹ giá bán.',
        'Thử What-if 5–10% giảm giá trước khi áp dụng thật.',
        'Giữ tồn gọn — nhập theo lô nhỏ hơn kỳ dự báo.',
      ],
      risks: [
        'Giảm giá sâu khi cầu vốn thấp dễ làm mỏng biên lợi nhuận.',
        'Tồn lâu ngày làm tăng chi phí lưu kho.',
      ],
    },
    sparse: {
      badge: 'Nhu cầu thấp / thiếu dữ liệu',
      title: `${name} chưa có tín hiệu cầu rõ`,
      summary:
        safeAvg <= 0
          ? `Chưa ghi nhận nhu cầu TB đáng kể trên ${hist} ngày lịch sử. Dự báo ${period} ngày gần như không đáng tin nếu thiếu đơn hoàn tất.`
          : `Nhu cầu TB chỉ ${avgLabel}/ngày → khoảng ${totalLabel} sản phẩm/${period} ngày. Nên bổ sung dữ liệu bán hoặc đẩy visibility sản phẩm trước khi nhập lớn.`,
      actions: [
        'Kiểm tra lịch sử đơn DELIVERED và trạng thái hiển thị SP trên cửa hàng.',
        'Ưu tiên marketing / flash sale nhỏ thay vì nhập số lượng lớn.',
        'Chọn SKU bán chạy hơn để chạy DSS song song.',
      ],
      risks: [
        'Dự báo Moving Average kém tin cậy khi mẫu lịch sử quá mỏng.',
        'Nhập hàng dựa trên con số thấp dễ gây tồn đọng vốn.',
      ],
    },
  }[tone]

  return { tone, ...base }
}

/** Chuỗi dự báo phẳng từ TB/ngày — dùng khi API series không có. */
export function buildFlatForecastSeries(
  averageDailyDemand: number,
  forecastPeriod: number,
  startDay = 1,
): { day: number; qty: number }[] {
  const avg = Number(averageDailyDemand)
  const days = Math.max(0, Math.min(90, Math.floor(Number(forecastPeriod) || 0)))
  if (!Number.isFinite(avg) || days <= 0) return []
  return Array.from({ length: days }, (_, i) => ({
    day: startDay + i,
    qty: Math.round(avg * 100) / 100,
  }))
}
