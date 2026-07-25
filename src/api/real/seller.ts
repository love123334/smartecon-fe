import { http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'
import type { ChartPoint } from '@/types'

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

interface BackendSellerDashboard {
  revenue?: { totalRevenue?: number | string; completedOrders?: number }
  orders?: { pendingOrders?: number; totalOrders?: number }
  products?: { totalProducts?: number; activeProducts?: number }
  inventory?: { lowStockCount?: number; totalStock?: number }
  recentOrders?: BackendRecentOrder[]
  lowStockProducts?: BackendLowStockProduct[]
  recommendations?: string[]
  averageRating?: number
  totalReviews?: number
  ratingWarning?: string
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
  lowStockProducts: Array<{ productId: string; productName: string; quantity: number }>
  recommendations: string[]
  averageRating?: number
  totalReviews?: number
  ratingWarning?: string
  recentOrders: Array<{
    orderId: string
    customer: string
    total: number
    status: string
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
      label: m.month,
      value: num(m.revenue),
    })),
    topProducts: (data.topProducts ?? []).map((p) => ({
      productId: String(p.productId),
      productName: p.productName,
      quantitySold: p.quantitySold ?? 0,
      revenue: num(p.revenue),
    })),
  }
}

function mapDashboard(data: BackendSellerDashboard): SellerDashboard {
  return {
    revenue: {
      totalRevenue: num(data.revenue?.totalRevenue),
      completedOrders: data.revenue?.completedOrders ?? 0,
    },
    lowStockProducts: (data.lowStockProducts ?? []).map((p) => ({
      productId: String(p.productId),
      productName: p.productName,
      quantity: p.quantity ?? 0,
    })),
    recommendations: data.recommendations ?? [],
    averageRating: data.averageRating,
    totalReviews: data.totalReviews,
    ratingWarning: data.ratingWarning,
    recentOrders: (data.recentOrders ?? []).map((o) => ({
      orderId: String(o.orderId),
      customer: o.customer,
      total: num(o.total),
      status: o.status,
    })),
  }
}

export async function getSalesPerformance(): Promise<SalesPerformance> {
  const data = await http.get<BackendSalesPerformance>(apiPaths.seller.salesPerformance)
  return mapSalesPerformance(data)
}

export async function getDashboard(): Promise<SellerDashboard> {
  const data = await http.get<BackendSellerDashboard>(apiPaths.seller.dashboard)
  return mapDashboard(data)
}
