import type { ChartPoint, Order, Product } from '@/types'

export function totalRevenue(orders: Order[]): number {
  return orders.reduce((s, o) => s + o.total, 0)
}

/** Biểu đồ doanh thu theo tháng từ đơn hàng thật */
export function monthlyRevenueChart(orders: Order[], maxMonths = 6): ChartPoint[] {
  const byMonth = new Map<string, number>()
  for (const o of orders) {
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

/** Doanh thu theo danh mục từ line items đơn hàng */
export function categoryRevenueChart(orders: Order[], products: Product[]): ChartPoint[] {
  const productCats = new Map(products.map((p) => [p.id, p.category]))
  const byCat = new Map<string, number>()
  for (const o of orders) {
    for (const item of o.items) {
      const cat = productCats.get(item.productId) ?? 'Khác'
      byCat.set(cat, (byCat.get(cat) ?? 0) + item.quantity * item.unitPrice)
    }
  }
  return [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value: Math.round(value) }))
}
