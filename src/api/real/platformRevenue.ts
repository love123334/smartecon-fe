import { http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'

export type RevenueGranularity = 'DAY' | 'MONTH'

export interface PlatformRevenueDashboardQuery {
  fromDate: string
  toDate: string
  granularity: RevenueGranularity
  topLimit: number
}

export interface PlatformRevenuePeriod {
  fromDate: string
  toDate: string
  granularity: RevenueGranularity
  generatedAt: string | null
}

export interface PlatformRevenueOverview {
  grossMerchandiseValue: number
  previousPeriodGmv: number | null
  gmvGrowthPercentage: number | null
  successfulPaymentAmount: number
  deliveredOrderValue: number
  totalDiscountAmount: number
  totalShippingFee: number
  totalOrders: number
  deliveredOrders: number
  averageOrderValue: number
  unitsSold: number
  activeSellerCount: number
  activeCustomerCount: number
}

export interface OrderStatusDistributionItem {
  status: string
  orderCount: number
  percentage: number
}

export interface RevenueTrendPoint {
  periodStart: string
  grossMerchandiseValue: number
  deliveredOrderValue: number
  deliveredOrders: number
  unitsSold: number
}

export interface TopSellerItem {
  sellerId: number
  sellerName: string
  grossMerchandiseValue: number
  deliveredOrders: number
  unitsSold: number
  marketSharePercentage: number
}

export interface TopProductItem {
  productId: number
  productName: string
  sellerId: number | null
  sellerName: string | null
  deliveredOrders: number
  unitsSold: number
  grossMerchandiseValue: number
}

export interface TopCategoryItem {
  categoryId: number | null
  categoryName: string | null
  deliveredOrders: number
  unitsSold: number
  grossMerchandiseValue: number
  marketSharePercentage: number
}

export interface PaymentMethodDistributionItem {
  paymentMethod: string
  totalPaymentCount: number
  successfulPaymentCount: number
  pendingPaymentCount: number
  failedPaymentCount: number
  successfulAmount: number
  percentage: number
}

export interface PlatformActivity {
  totalSellers: number
  activeSellerAccounts: number
  newSellers: number
  totalCustomers: number
  activeCustomerAccounts: number
  newCustomers: number
  totalProducts: number
  activeProducts: number
  inactiveProducts: number
  outOfStockProducts: number
  newProducts: number
  totalCategories: number
  uncategorizedProducts: number
}

export interface PlatformActivityTrendPoint {
  periodStart: string
  newSellers: number
  newCustomers: number
  newProducts: number
}

export interface PlatformRevenueDashboard {
  period: PlatformRevenuePeriod
  overview: PlatformRevenueOverview
  orderStatusDistribution: OrderStatusDistributionItem[] | null
  revenueTrend: RevenueTrendPoint[] | null
  topSellers: TopSellerItem[] | null
  topProducts: TopProductItem[] | null
  topCategories: TopCategoryItem[] | null
  paymentMethodDistribution: PaymentMethodDistributionItem[] | null
  platformActivity: PlatformActivity | null
  activityTrend: PlatformActivityTrendPoint[] | null
}

export function getPlatformRevenueDashboard(query: PlatformRevenueDashboardQuery) {
  const qs = new URLSearchParams({
    fromDate: query.fromDate,
    toDate: query.toDate,
    granularity: query.granularity,
    topLimit: String(query.topLimit),
  })
  return http.get<PlatformRevenueDashboard>(
    `${apiPaths.manager.platformRevenueDashboard}?${qs}`,
  )
}
