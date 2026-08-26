import type { ChatIntent } from '@/api/chat/intents'

/** Nhóm routing — quyết định tool + prompt trước khi gọi LLM. */
export type ChatRoute =
  | 'GENERAL_CHAT'
  | 'PRODUCT_QUERY'
  | 'CATALOG_INSIGHT'
  | 'SALES_ANALYSIS'
  | 'INVENTORY'
  | 'PRICE_RECOMMENDATION'
  | 'WHAT_IF'
  | 'ORDERS_CART'
  | 'MANAGER_OPS'
  | 'UNKNOWN'

const PRODUCT_INTENTS = new Set<ChatIntent>([
  'product_search',
  'product_budget',
  'product_cheapest',
  'category_browse',
  'recommend',
  'compare',
  'product_info',
  'product_price',
  'product_stock',
  'product_review',
  'shop_overview',
  'categories',
  'where_to_buy',
  'contact_seller',
])

const SALES_INTENTS = new Set<ChatIntent>([
  'seller_revenue',
  'seller_top_products',
  'seller_recent_orders',
  'seller_orders',
  'seller_purchase_orders',
])

const INVENTORY_INTENTS = new Set<ChatIntent>([
  'seller_inventory',
  'seller_dss_inventory',
])

const PRICE_INTENTS = new Set<ChatIntent>([
  'seller_pricing',
  'seller_dss_price',
  'seller_dss_demand',
])

const WHAT_IF_INTENTS = new Set<ChatIntent>(['seller_whatif', 'manager_whatif'])

const ORDER_INTENTS = new Set<ChatIntent>([
  'orders',
  'order_detail',
  'order_cancel',
  'cart',
  'cart_summary',
  'shipping',
  'checkout',
  'payment',
  'return_policy',
  'promo',
])

const MANAGER_INTENTS = new Set<ChatIntent>([
  'manager_kpi',
  'manager_pending',
  'manager_revenue',
  'manager_segment',
  'manager_trend',
  'manager_insights',
])

const GENERAL_INTENTS = new Set<ChatIntent>([
  'greeting',
  'thanks',
  'help',
  'platform',
  'contact_escalate',
  'complaint',
  'account',
  'password',
])

const CATALOG_INSIGHT_INTENTS = new Set<ChatIntent>(['shop_overview', 'categories', 'recommend'])

export function routeFromIntent(intent: ChatIntent | null): ChatRoute {
  if (!intent) return 'UNKNOWN'
  if (GENERAL_INTENTS.has(intent)) return 'GENERAL_CHAT'
  if (CATALOG_INSIGHT_INTENTS.has(intent)) return 'CATALOG_INSIGHT'
  if (PRODUCT_INTENTS.has(intent)) return 'PRODUCT_QUERY'
  if (WHAT_IF_INTENTS.has(intent)) return 'WHAT_IF'
  if (PRICE_INTENTS.has(intent)) return 'PRICE_RECOMMENDATION'
  if (INVENTORY_INTENTS.has(intent)) return 'INVENTORY'
  if (SALES_INTENTS.has(intent)) return 'SALES_ANALYSIS'
  if (ORDER_INTENTS.has(intent)) return 'ORDERS_CART'
  if (MANAGER_INTENTS.has(intent)) return 'MANAGER_OPS'
  if (intent.startsWith('admin_')) return 'MANAGER_OPS'
  return 'UNKNOWN'
}

export function routeLabel(route: ChatRoute): string {
  const labels: Record<ChatRoute, string> = {
    GENERAL_CHAT: 'Hội thoại chung',
    PRODUCT_QUERY: 'Tra cứu sản phẩm',
    CATALOG_INSIGHT: 'Phân tích catalog / gợi ý',
    SALES_ANALYSIS: 'Phân tích bán hàng',
    INVENTORY: 'Tồn kho',
    PRICE_RECOMMENDATION: 'Gợi ý giá / nhu cầu',
    WHAT_IF: 'Mô phỏng what-if',
    ORDERS_CART: 'Đơn hàng / giỏ',
    MANAGER_OPS: 'Vận hành quản lý',
    UNKNOWN: 'Chưa phân loại',
  }
  return labels[route]
}
