import { http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'
import type { ChartPoint, Order } from '@/types'

function num(v: number | string | undefined, fallback = 0): number {
  if (v == null) return fallback
  return typeof v === 'number' ? v : Number(v)
}

interface BackendSalesSummary {
  totalRevenue: number | string
  completedOrders: number
  averageOrderValue: number | string
}

interface BackendMonthlyRevenue {
  month: string
  revenue: number | string
}

interface BackendTopProduct {
  productId: number
  productName: string
  quantitySold: number
  revenue: number | string
}

interface BackendSalesPerformance {
  summary: BackendSalesSummary
  monthlyRevenue: BackendMonthlyRevenue[]
  topProducts: BackendTopProduct[]
}

interface BackendLowStockProduct {
  productId: number
  productName: string
  quantity: number
}

interface BackendRecentOrder {
  orderId: number
  customer: string
  total: number | string
  status: string
  createdAt?: string
}

interface BackendSellerRating {
  averageRating?: number
  totalReviews?: number
  warning?: string | null
  ratingBreakdown?: Array<{ rating: number; count: number; percentage: number }>
  recentReviews?: Array<{
    reviewId: number
    productId: number
    productName: string
    rating: number
    comment: string
    createdAt?: string
  }>
}

interface BackendOrderCounts {
  pending?: number
  processing?: number
  shipping?: number
  delivered?: number
  pendingOrders?: number
  totalOrders?: number
}

interface BackendInventorySummary {
  lowStockProducts?: number
  outOfStockProducts?: number
  lowStockCount?: number
  totalStock?: number
}

interface BackendSellerDashboard {
  revenue?: { totalRevenue?: number | string; completedOrders?: number }
  orders?: BackendOrderCounts
  products?: { totalProducts?: number; activeProducts?: number }
  inventory?: BackendInventorySummary
  recentOrders?: BackendRecentOrder[]
  lowStockProducts?: BackendLowStockProduct[]
  recommendations?: string[]
  averageRating?: number
  totalReviews?: number
  ratingWarning?: string
  rating?: BackendSellerRating
}

export interface SalesPerformance {
  summary: {
    totalRevenue: number
    completedOrders: number
    averageOrderValue: number
  }
  monthlyRevenue: ChartPoint[]
  topProducts: Array<{
    productId: string
    productName: string
    quantitySold: number
    revenue: number
  }>
}

export interface SellerDashboard {
  revenue: { totalRevenue: number; completedOrders: number }
  orders: {
    pending: number
    processing: number
    shipping: number
    delivered: number
  }
  products: { totalProducts: number; activeProducts: number }
  inventory: { lowStockCount: number; outOfStockCount: number }
  lowStockProducts: Array<{ productId: string; productName: string; quantity: number }>
  recommendations: string[]
  averageRating?: number
  totalReviews?: number
  ratingWarning?: string
  recentReviews: Array<{
    id: string
    productId: string
    productName: string
    rating: number
    comment: string
    createdAt: string
  }>
  recentOrders: Array<{
    orderId: string
    customer: string
    total: number
    status: string
    createdAt?: string
  }>
}

function mapSalesPerformance(data: BackendSalesPerformance): SalesPerformance {
  return {
    summary: {
      totalRevenue: num(data.summary?.totalRevenue),
      completedOrders: data.summary?.completedOrders ?? 0,
      averageOrderValue: num(data.summary?.averageOrderValue),
    },
    monthlyRevenue: (data.monthlyRevenue ?? []).map((m) => ({
      label: String(m.month),
      value: num(m.revenue),
    })),
    topProducts: (data.topProducts ?? []).map((p) => ({
      productId: String(p.productId),
      productName: p.productName,
      quantitySold: Number(p.quantitySold ?? 0),
      revenue: num(p.revenue),
    })),
  }
}

function mapDashboard(data: BackendSellerDashboard): SellerDashboard {
  const rating = data.rating
  return {
    revenue: {
      totalRevenue: num(data.revenue?.totalRevenue),
      completedOrders: data.revenue?.completedOrders ?? 0,
    },
    orders: {
      pending: data.orders?.pending ?? data.orders?.pendingOrders ?? 0,
      processing: data.orders?.processing ?? 0,
      shipping: data.orders?.shipping ?? 0,
      delivered: data.orders?.delivered ?? 0,
    },
    products: {
      totalProducts: data.products?.totalProducts ?? 0,
      activeProducts: data.products?.activeProducts ?? 0,
    },
    inventory: {
      lowStockCount: data.inventory?.lowStockProducts ?? data.inventory?.lowStockCount ?? 0,
      outOfStockCount: data.inventory?.outOfStockProducts ?? 0,
    },
    lowStockProducts: (data.lowStockProducts ?? []).map((p) => ({
      productId: String(p.productId),
      productName: p.productName,
      quantity: p.quantity ?? 0,
    })),
    recommendations: data.recommendations ?? [],
    averageRating: data.averageRating ?? rating?.averageRating,
    totalReviews: data.totalReviews ?? rating?.totalReviews,
    ratingWarning: data.ratingWarning ?? rating?.warning ?? undefined,
    recentReviews: (rating?.recentReviews ?? []).map((r) => ({
      id: String(r.reviewId),
      productId: String(r.productId),
      productName: r.productName,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt ?? new Date().toISOString(),
    })),
    recentOrders: (data.recentOrders ?? []).map((o) => ({
      orderId: String(o.orderId),
      customer: o.customer,
      total: num(o.total),
      status: o.status,
      createdAt: o.createdAt,
    })),
  }
}

export function ordersFromDashboardRecent(recent: SellerDashboard['recentOrders']): Order[] {
  const statusMap: Record<string, Order['status']> = {
    PENDING: 'pending',
    PAID: 'confirmed',
    PROCESSING: 'confirmed',
    SHIPPING: 'shipping',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    REFUNDED: 'cancelled',
  }
  return recent.map((o) => ({
    id: o.orderId,
    customerId: '',
    customerName: o.customer,
    items: [],
    total: o.total,
    status: statusMap[o.status] ?? 'pending',
    rawStatus: o.status,
    shippingAddress: '',
    createdAt: o.createdAt ?? new Date().toISOString(),
    updatedAt: o.createdAt ?? new Date().toISOString(),
  }))
}

export async function getSalesPerformance(): Promise<SalesPerformance> {
  const data = await http.get<BackendSalesPerformance>(apiPaths.seller.salesPerformance)
  return mapSalesPerformance(data)
}

export async function getDashboard(): Promise<SellerDashboard> {
  const data = await http.get<BackendSellerDashboard>(apiPaths.seller.dashboard)
  return mapDashboard(data)
}
