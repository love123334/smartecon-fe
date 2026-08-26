/** Client-side mirror of backend DemandTrendInsight — fallback if API lacks combined fields. */

const STRONG_LIFT = 1.5
const HIGH_LEVEL_LIFT = 1.35
const SIDEWAYS_PCT = 0.18
const WALK_AGREEMENT = 0.65

export type DemandTrendDirection = 'up' | 'down' | 'stable'

export type DemandTrendCombined =
  | 'continue_up'
  | 'up_to_high_stable'
  | 'up_to_stable'
  | 'up_then_cool'
  | 'stable'
  | 'may_rise'
  | 'may_fall'
  | 'continue_down'
  | 'down_to_stable'
  | 'recovering'

export interface DemandTrendInsightView {
  historyLabel: string
  forecastLabel: string
  combined: DemandTrendCombined
  insightLabel: string
  recommendation: string
}

function avg(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function levelWindowSize(n: number): number {
  if (n < 14) return Math.max(3, Math.floor(n / 2))
  return Math.min(14, Math.max(7, Math.floor(n / 6)))
}

function formatQty(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 10) / 10
  if (Math.abs(rounded - Math.round(rounded)) < 0.05) return String(Math.round(rounded))
  return rounded.toFixed(1)
}

function historyDir(liftRatio: number): DemandTrendDirection {
  if (liftRatio >= STRONG_LIFT) return 'up'
  if (liftRatio <= 0.67) return 'down'
  return 'stable'
}

function forecastDir(forecast: number[], recentLevel: number): DemandTrendDirection {
  if (forecast.length < 2) return 'stable'
  const mean = avg(forecast)
  const mid = Math.max(1, Math.ceil((forecast.length + 1) / 2))
  const first = forecast.length >= 14 ? avg(forecast.slice(0, 7)) : avg(forecast.slice(0, mid))
  const last = forecast.length >= 14 ? avg(forecast.slice(-7)) : avg(forecast.slice(mid))
  const intraPct = (last - first) / Math.max(1, first)
  const vsRecent = (mean - recentLevel) / Math.max(1, recentLevel)

  if (intraPct <= -SIDEWAYS_PCT) return 'down'
  if (intraPct >= SIDEWAYS_PCT) return 'up'
  const walk = consistentWalk(forecast, mean)
  if (walk !== 'stable') return walk
  if (Math.abs(vsRecent) <= SIDEWAYS_PCT) return 'stable'
  if (vsRecent > SIDEWAYS_PCT) return 'up'
  if (vsRecent < -SIDEWAYS_PCT) return 'down'
  return 'stable'
}

function consistentWalk(forecast: number[], mean: number): DemandTrendDirection {
  if (forecast.length < 3) return 'stable'
  const eps = Math.max(0.05, 0.02 * Math.abs(mean))
  let up = 0
  let down = 0
  const steps = forecast.length - 1
  for (let i = 1; i < forecast.length; i++) {
    const delta = forecast[i] - forecast[i - 1]
    if (delta > eps) up++
    else if (delta < -eps) down++
  }
  const need = WALK_AGREEMENT * steps
  if (up >= need) return 'up'
  if (down >= need) return 'down'
  return 'stable'
}

function combine(
  history: DemandTrendDirection,
  forecast: DemandTrendDirection,
  highLevel: boolean,
): DemandTrendCombined {
  if (history === 'up' && forecast === 'up') return 'continue_up'
  if (history === 'up' && forecast === 'stable') return highLevel ? 'up_to_high_stable' : 'up_to_stable'
  if (history === 'up' && forecast === 'down') return 'up_then_cool'
  if (history === 'stable' && forecast === 'up') return 'may_rise'
  if (history === 'stable' && forecast === 'down') return 'may_fall'
  if (history === 'down' && forecast === 'down') return 'continue_down'
  if (history === 'down' && forecast === 'stable') return 'down_to_stable'
  if (history === 'down' && forecast === 'up') return 'recovering'
  return 'stable'
}

const INSIGHT_LABEL: Record<DemandTrendCombined, string> = {
  continue_up: 'Tăng và tiếp tục tăng',
  up_to_high_stable: 'Tăng → ổn định ở mức cao',
  up_to_stable: 'Tăng → ổn định',
  up_then_cool: 'Tăng nhưng có dấu hiệu hạ nhiệt',
  stable: 'Ổn định',
  may_rise: 'Có khả năng tăng',
  may_fall: 'Có khả năng giảm',
  continue_down: 'Giảm rõ rệt',
  down_to_stable: 'Giảm → ổn định',
  recovering: 'Có dấu hiệu phục hồi',
}

function historyLabel(direction: DemandTrendDirection, liftRatio: number): string {
  if (direction === 'up' && liftRatio >= STRONG_LIFT) return 'Đang tăng mạnh'
  if (direction === 'down' && liftRatio <= 0.67) return 'Đang giảm mạnh'
  if (direction === 'up') return 'Đang tăng'
  if (direction === 'down') return 'Đang giảm'
  return 'Tương đối ổn định'
}

function forecastLabel(direction: DemandTrendDirection, highLevel: boolean, lowLevel: boolean): string {
  if (direction === 'stable' && highLevel) return 'Ổn định ở mức cao'
  if (direction === 'stable' && lowLevel) return 'Ổn định ở mức thấp'
  if (direction === 'stable') return 'Ổn định'
  if (direction === 'up') return 'Đang tăng'
  return 'Đang giảm'
}

function recommendation(combined: DemandTrendCombined, qty: string): string {
  switch (combined) {
    case 'up_to_high_stable':
    case 'up_to_stable':
      return `Nhu cầu gần đây đang tăng mạnh và dự báo duy trì ở mức cao khoảng ${qty} đơn/ngày. Nên giữ tồn kho cao hơn giai đoạn trước và theo dõi xem mức này có đứng vững sau 2–4 tuần.`
    case 'continue_up':
      return `Dự báo tiếp tục tăng — chủ động nhập thêm theo nhịp ~${qty} đơn/ngày, tránh hết hàng giữa kỳ.`
    case 'up_then_cool':
      return `Đã tăng nhưng có dấu hiệu hạ nhiệt. Giữ tồn đủ cho ~${qty} đơn/ngày, chưa tăng nhập mạnh thêm.`
    case 'recovering':
      return `Có tín hiệu phục hồi. Tăng tồn nhẹ theo dự báo ~${qty} đơn/ngày và theo dõi 1–2 tuần.`
    case 'continue_down':
      return `Nhu cầu giảm rõ — hạ tồn, tránh nhập dày; kỳ tới khoảng ${qty} đơn/ngày.`
    case 'down_to_stable':
      return `Đã giảm rồi đi ngang quanh ${qty} đơn/ngày. Điều chỉnh tồn về mức mới, chưa cắt sâu thêm.`
    case 'may_rise':
      return `Có khả năng tăng. Sẵn sàng tồn đệm quanh ${qty} đơn/ngày.`
    case 'may_fall':
      return `Có khả năng giảm. Giữ tồn vừa, ưu tiên xả chậm nếu bán chậm hơn kỳ trước.`
    default:
      return `Nhu cầu ổn định quanh ${qty} đơn/ngày. Duy trì tồn xoay vòng, tránh nhập đột biến.`
  }
}

export function interpretDemandTrend(
  historyQty: number[],
  forecastQty: number[],
): DemandTrendInsightView | null {
  if (historyQty.length < 4 || forecastQty.length < 2) return null
  const n = historyQty.length
  const window = levelWindowSize(n)
  const recentLevel = avg(historyQty.slice(-window))
  const earlierLevel = avg(historyQty.slice(0, Math.max(window, Math.floor(n / 2))))
  const liftRatio = recentLevel / Math.max(1, earlierLevel)
  const highLevel = recentLevel >= earlierLevel * HIGH_LEVEL_LIFT && recentLevel >= 1.5
  const lowLevel = recentLevel <= earlierLevel * 0.75 && earlierLevel >= 1.5
  const history = historyDir(liftRatio)
  const forecast = forecastDir(forecastQty, recentLevel)
  const combined = combine(history, forecast, highLevel)
  const qty = formatQty(avg(forecastQty))
  return {
    historyLabel: historyLabel(history, liftRatio),
    forecastLabel: forecastLabel(forecast, highLevel, lowLevel),
    combined,
    insightLabel: INSIGHT_LABEL[combined],
    recommendation: recommendation(combined, qty),
  }
}
