import { normalizeText } from '@/api/chat/match'
import { orderStatusLabel } from '@/utils/orderStatus'
import type { Order, OrderStatus } from '@/types'

export type OrderTimeRangeType = 'today' | 'yesterday' | 'this_week' | 'recent' | 'all'

export interface OrderTimeRange {
  type: OrderTimeRangeType
  /** Giới hạn khi type = recent */
  limit?: number
}

export type OrderStatusFilter = OrderStatus | 'in_transit' | null

export type OrderDetailLevel = 'summary' | 'detail' | 'tracking'

export interface OrderQuerySpec {
  timeRange: OrderTimeRange
  statusFilter: OrderStatusFilter
  detailLevel: OrderDetailLevel
  latestOnly: boolean
  /** User explicitly asked for similar/alternative products in order context — unused here */
  scopeLabel?: string
}

export interface ParsedOrderContext {
  spec: OrderQuerySpec
  /** Follow-up giữ filter trạng thái / thời gian từ lượt trước */
  fromPrior: boolean
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

function startOfLocalWeek(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  const monday = new Date(d)
  monday.setDate(d.getDate() - diff)
  return startOfLocalDay(monday)
}

function orderCreatedAt(o: Order): Date {
  const t = new Date(o.createdAt)
  return Number.isNaN(t.getTime()) ? new Date(0) : t
}

function matchesStatusFilter(o: Order, filter: OrderStatusFilter): boolean {
  if (!filter) return true
  if (filter === 'in_transit') {
    return o.status === 'shipping' || o.status === 'confirmed'
  }
  return o.status === filter
}

function inTimeRange(o: Order, range: OrderTimeRange, now = new Date()): boolean {
  const created = orderCreatedAt(o)
  if (range.type === 'all') return true

  if (range.type === 'today') {
    return created >= startOfLocalDay(now) && created <= endOfLocalDay(now)
  }
  if (range.type === 'yesterday') {
    const y = new Date(now)
    y.setDate(now.getDate() - 1)
    return created >= startOfLocalDay(y) && created <= endOfLocalDay(y)
  }
  if (range.type === 'this_week') {
    return created >= startOfLocalWeek(now) && created <= now
  }
  return true
}

export function defaultOrderQuerySpec(): OrderQuerySpec {
  return {
    timeRange: { type: 'all' },
    statusFilter: null,
    detailLevel: 'summary',
    latestOnly: false,
  }
}

/** Resolve temporal + status + detail từ câu hỏi (và context order lượt trước). */
export function parseOrderQuery(
  raw: string,
  prior?: Partial<OrderQuerySpec>,
): ParsedOrderContext {
  const n = normalizeText(raw)
  const spec: OrderQuerySpec = {
    ...defaultOrderQuerySpec(),
    ...prior,
  }
  let fromPrior = false

  const asksOrders =
    /don hang|don cua|don cua toi|don cua minh|don cua ban|my order|order status|don the nao|tinh trang don|lich su mua|theo doi don|hom nay.*mua|mua gi hom nay|don hom nay|don hom qua|don gan day|don cuoi|don dang giao|don da giao|don nay bao gio|chi tiet don/.test(
      n,
    ) || Boolean(prior?.statusFilter || prior?.timeRange?.type !== 'all')

  if (!asksOrders && prior?.statusFilter) {
    fromPrior = true
    return { spec, fromPrior }
  }

  if (/chi tiet|ma don|don #|order id|don so \d|gom gi|co gi trong don/.test(n)) {
    spec.detailLevel = 'detail'
  } else if (/bao gio toi|bao gio giao|khi nao giao|tracking|van chuyen|ship/.test(n)) {
    spec.detailLevel = 'tracking'
  } else if (/tom tat|tong quan|sao roi|the nao|tinh hinh/.test(n)) {
    spec.detailLevel = 'summary'
  }

  if (/hom nay|today|hom nay mua|mua hom nay/.test(n)) {
    spec.timeRange = { type: 'today' }
  } else if (/hom qua|yesterday/.test(n)) {
    spec.timeRange = { type: 'yesterday' }
  } else if (/tuan nay|this week|trong tuan/.test(n)) {
    spec.timeRange = { type: 'this_week' }
  } else if (/gan day|recent|moi day|vua dat|vua mua/.test(n)) {
    spec.timeRange = { type: 'recent', limit: 5 }
  } else if (/don cuoi|don moi nhat|latest order|last order|don gan nhat/.test(n)) {
    spec.latestOnly = true
    spec.timeRange = { type: 'recent', limit: 1 }
  }

  if (/dang giao|van chuyen|shipping|on the way|dang ship/.test(n)) {
    spec.statusFilter = 'in_transit'
  } else if (/da giao|delivered|giao xong|nhan hang roi/.test(n)) {
    spec.statusFilter = 'delivered'
  } else if (/cho xac nhan|pending|chua xac nhan/.test(n)) {
    spec.statusFilter = 'pending'
  } else if (/da huy|cancelled|huy roi/.test(n)) {
    spec.statusFilter = 'cancelled'
  } else if (/da xac nhan|confirmed/.test(n)) {
    spec.statusFilter = 'confirmed'
  }

  if (
    prior &&
    (prior.statusFilter || prior.timeRange?.type !== 'all') &&
    !/hom nay|hom qua|tuan nay|gan day/.test(n) &&
    (/don|order|giao|ship|trang thai|con don|con lai/.test(n) ||
      /dang giao|da giao|van chuyen|cho xac nhan|da huy/.test(n))
  ) {
    fromPrior = true
    if (!spec.statusFilter && prior.statusFilter) spec.statusFilter = prior.statusFilter
    if (spec.timeRange.type === 'all' && prior.timeRange && prior.timeRange.type !== 'all') {
      spec.timeRange = prior.timeRange
    }
  }

  if (spec.timeRange.type === 'today') spec.scopeLabel = 'hôm nay'
  else if (spec.timeRange.type === 'yesterday') spec.scopeLabel = 'hôm qua'
  else if (spec.timeRange.type === 'this_week') spec.scopeLabel = 'tuần này'
  else if (spec.latestOnly) spec.scopeLabel = 'gần nhất'

  return { spec, fromPrior }
}

export function filterOrdersBySpec(
  orders: Order[],
  spec: OrderQuerySpec,
  now = new Date(),
): Order[] {
  let list = [...orders].sort(
    (a, b) => orderCreatedAt(b).getTime() - orderCreatedAt(a).getTime(),
  )

  list = list.filter((o) => inTimeRange(o, spec.timeRange, now))
  list = list.filter((o) => matchesStatusFilter(o, spec.statusFilter))

  if (spec.timeRange.type === 'recent' && spec.timeRange.limit) {
    list = list.slice(0, spec.timeRange.limit)
  }
  if (spec.latestOnly && list.length > 1) {
    list = list.slice(0, 1)
  }

  return list
}

function statusSummaryPhrase(status: OrderStatus): string {
  switch (status) {
    case 'delivered':
      return 'đã giao thành công'
    case 'shipping':
      return 'đang được vận chuyển'
    case 'confirmed':
      return 'đã xác nhận, chờ giao'
    case 'pending':
      return 'đang chờ xác nhận'
    case 'cancelled':
      return 'đã hủy'
    default:
      return orderStatusLabel(status).toLowerCase()
  }
}

function groupStatusSummary(orders: Order[]): string[] {
  const counts = new Map<OrderStatus, number>()
  for (const o of orders) {
    counts.set(o.status, (counts.get(o.status) ?? 0) + 1)
  }
  const parts: string[] = []
  for (const [status, count] of counts) {
    const phrase = statusSummaryPhrase(status)
    if (count === 1) parts.push(`một đơn ${phrase}`)
    else parts.push(`${count} đơn ${phrase}`)
  }
  return parts
}

function joinNatural(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  if (parts.length === 2) return `${parts[0]} và ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, còn ${parts[parts.length - 1]}`
}

function formatOrderDetail(o: Order): string {
  const items = o.items
    .slice(0, 4)
    .map((i) => i.productName)
    .join(', ')
  return `Đơn **#${o.id}** gồm ${items || '—'}, tổng **${formatVndShort(o.total)}** — **${orderStatusLabel(o.status)}**.`
}

function formatVndShort(n: number): string {
  return `${Math.round(n).toLocaleString('vi-VN')}đ`
}

function trackingLine(o: Order): string {
  if (o.status === 'delivered') {
    return `Đơn **#${o.id}** đã giao xong.`
  }
  if (o.status === 'shipping' || o.status === 'confirmed') {
    return `Đơn **#${o.id}** đang trên đường giao — mình chưa có ETA cụ thể trên hệ thống, bạn theo dõi thêm ở **Đơn hàng**.`
  }
  if (o.status === 'pending') {
    return `Đơn **#${o.id}** shop vẫn đang xác nhận — chưa bắt đầu giao.`
  }
  return `Đơn **#${o.id}** — **${orderStatusLabel(o.status)}**.`
}

/** Presentation layer — không dump raw DB fields. */
export function presentOrdersReply(
  orders: Order[],
  spec: OrderQuerySpec,
  opts?: { userName?: string },
): string {
  const name = opts?.userName?.trim()
    ? `${opts.userName.trim().split(/\s+/)[0]}, `
    : ''
  const scope = spec.scopeLabel ?? ''
  const statusHint =
    spec.statusFilter === 'in_transit'
      ? ' đang giao'
      : spec.statusFilter === 'delivered'
        ? ' đã giao'
        : spec.statusFilter
          ? ` ${orderStatusLabel(spec.statusFilter).toLowerCase()}`
          : ''

  if (!orders.length) {
    if (scope) {
      return `${name}${scope.charAt(0).toUpperCase() + scope.slice(1)} bạn chưa có đơn${statusHint} nào.`
    }
    if (statusHint) {
      return `${name}Hiện bạn không có đơn${statusHint} nào.`
    }
    return `${name}Bạn chưa có đơn hàng nào. Thêm sản phẩm vào giỏ rồi thanh toán nhé.`
  }

  if (spec.detailLevel === 'tracking') {
    return `${name}${trackingLine(orders[0])}`
  }

  if (spec.detailLevel === 'detail' || spec.latestOnly) {
    if (orders.length === 1) {
      return `${name}${formatOrderDetail(orders[0])}`
    }
    const lines = orders.slice(0, 3).map((o) => formatOrderDetail(o))
    return `${name}${lines.join('\n')}`
  }

  const count = orders.length
  const scopePrefix = scope ? `${scope.charAt(0).toUpperCase() + scope.slice(1)} ` : ''

  if (count === 1) {
    const o = orders[0]
    return `${name}${scopePrefix}bạn có 1 đơn — ${statusSummaryPhrase(o.status)}.`
  }

  const groups = groupStatusSummary(orders)
  return `${name}${scopePrefix}bạn có **${count}** đơn. ${joinNatural(groups).charAt(0).toUpperCase() + joinNatural(groups).slice(1)}.`
}

/** Facts ngắn cho LLM — không dump metadata. */
export function presentOrdersFacts(orders: Order[], spec: OrderQuerySpec): string {
  const filtered = filterOrdersBySpec(orders, spec)
  if (!filtered.length) return 'Không có đơn khớp phạm vi hỏi.'
  if (spec.detailLevel === 'detail') {
    return filtered
      .slice(0, 3)
      .map((o) => `#${o.id} ${orderStatusLabel(o.status)} ${formatVndShort(o.total)}`)
      .join('; ')
  }
  return presentOrdersReply(filtered, { ...spec, detailLevel: 'summary' })
    .replace(/\*\*/g, '')
}
