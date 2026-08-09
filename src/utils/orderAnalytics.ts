import type { ChartPoint, Order, Product } from '@/types'
import type { BackendOrderStatus } from '@/utils/backendOrderStatus'

const NON_SALES_RAW: ReadonlySet<BackendOrderStatus> = new Set([
  'PENDING',
  'CANCELLED',
  'REFUNDED',
])

/** Đơn chờ xác nhận / đã hủy / hoàn tiền không được cộng vào doanh số. */
export function orderCountsTowardSales(order: Order): boolean {
  const raw = order.rawStatus?.toUpperCase() as BackendOrderStatus | undefined
  if (raw) {
    return !NON_SALES_RAW.has(raw)
  }
  return order.status !== 'pending' && order.status !== 'cancelled'
}

export function salesEligibleOrders(orders: Order[]): Order[] {
  return orders.filter(orderCountsTowardSales)
}

/** Loại bỏ đơn trùng id (giữ bản đầu tiên theo thứ tự mảng). */
export function dedupeOrdersById<T extends { id: string }>(orders: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const o of orders) {
    if (seen.has(o.id)) continue
    seen.add(o.id)
    out.push(o)
  }
  return out
}

export function dedupeRecentSellerOrders<T extends { orderId: string }>(rows: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    if (seen.has(row.orderId)) continue
    seen.add(row.orderId)
    out.push(row)
  }
  return out
}

export function totalRevenue(orders: Order[]): number {
  return salesEligibleOrders(orders).reduce((s, o) => s + o.total, 0)
}

/** Biểu đồ doanh thu theo tháng từ đơn hàng thật (bỏ qua chờ xác nhận / hủy). */
export function monthlyRevenueChart(orders: Order[], maxMonths = 6): ChartPoint[] {
  const byMonth = new Map<string, number>()
  for (const o of salesEligibleOrders(orders)) {
    const d = new Date(o.createdAt)
    if (Number.isNaN(d.getTime())) continue
    const label = `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`
    byMonth.set(label, (byMonth.get(label) ?? 0) + o.total)
  }
  return [...byMonth.entries()]
    .sort((a, b) => {
      const parse = (s: string) => {
        const m = s.match(/T(\d+)\/(\d+)/)
        return m ? Number(m[2]) * 100 + Number(m[1]) : 0
      }
      return parse(a[0]) - parse(b[0])
    })
    .slice(-maxMonths)
    .map(([label, value]) => ({ label, value: Math.round(value) }))
}

/** Doanh thu theo danh mục từ line items đơn hàng (bỏ qua chờ xác nhận / hủy). */
export function categoryRevenueChart(orders: Order[], products: Product[]): ChartPoint[] {
  const productCats = new Map(products.map((p) => [p.id, p.category]))
  const byCat = new Map<string, number>()
  for (const o of salesEligibleOrders(orders)) {
    for (const item of o.items) {
      const cat = productCats.get(item.productId) ?? 'Khác'
      byCat.set(cat, (byCat.get(cat) ?? 0) + item.quantity * item.unitPrice)
    }
  }
  return [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value: Math.round(value) }))
}
