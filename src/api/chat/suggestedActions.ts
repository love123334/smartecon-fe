import type { ChatIntent } from '@/api/chat/intents'
import type { ChatSuggestedAction } from '@/types'

function nav(id: string, label: string, to: string): ChatSuggestedAction {
  return { id, label, prompt: '', to }
}

/** Deep-link / follow-up chips dưới bubble — seller: nút mở trang trực quan. */
export function deriveSuggestedActions(
  intent: ChatIntent | null,
  _hasProductFocus: boolean,
  role: 'guest' | 'customer' | 'seller' | 'manager' | 'admin',
): ChatSuggestedAction[] {
  if (!intent) return []

  if (role === 'seller') {
    switch (intent) {
      case 'seller_revenue':
      case 'seller_business_health':
      case 'seller_profit':
      case 'seller_top_products':
        return [
          nav('seller-sales', 'Bảng doanh số', '/seller/sales'),
          nav('seller-orders', 'Đơn bán', '/seller/orders'),
        ]
      case 'seller_orders':
      case 'seller_recent_orders':
        return [
          nav('seller-orders', 'Đơn bán', '/seller/orders'),
          nav('seller-sales', 'Doanh số', '/seller/sales'),
        ]
      case 'seller_purchase_orders':
        return [
          nav('buyer-orders', 'Đơn mua của tôi', '/orders'),
          nav('seller-orders', 'Đơn bán', '/seller/orders'),
        ]
      case 'seller_inventory':
      case 'seller_add_product':
        return [
          nav('seller-products', 'Quản lý SP', '/seller/products'),
          nav('seller-dss-inv', 'DSS tồn kho', '/seller/dss/inventory'),
        ]
      case 'seller_dss_demand':
        return [
          nav('seller-dss-demand', 'Dự báo nhu cầu', '/seller/dss/demand-lightgbm-demo'),
          nav('seller-dss', 'DSS', '/seller/dss'),
        ]
      case 'seller_dss_price':
      case 'seller_pricing':
        return [
          nav('seller-dss-price', 'Gợi ý giá', '/seller/dss/advanced-price'),
          nav('seller-dss', 'DSS', '/seller/dss'),
        ]
      case 'seller_dss_inventory':
        return [
          nav('seller-dss-inv', 'Khuyến nghị tồn', '/seller/dss/inventory'),
          nav('seller-products', 'Quản lý SP', '/seller/products'),
        ]
      case 'seller_whatif':
        return [
          nav('seller-whatif', 'What-if giá', '/seller/dss/what-if'),
          nav('seller-economics', 'What-if hiệu suất', '/seller/dss/order-economics'),
        ]
      case 'seller_dss_explain':
      case 'seller_promo':
        return [
          nav('seller-dss', 'Mở DSS', '/seller/dss'),
          nav('seller-sales', 'Doanh số', '/seller/sales'),
        ]
      case 'seller_rating':
        return [nav('seller-products', 'Quản lý SP', '/seller/products')]
      default:
        return []
    }
  }

  if (role === 'manager') {
    switch (intent) {
      case 'manager_kpi':
      case 'manager_revenue':
      case 'manager_insights':
      case 'manager_trend':
      case 'manager_segment':
        return [nav('mgr-dash', 'Dashboard', '/manager/dashboard')]
      case 'manager_pending':
        return [nav('mgr-dash', 'Dashboard', '/manager/dashboard')]
      case 'manager_whatif':
        return [nav('mgr-whatif', 'What-if KM', '/manager/dss/what-if')]
      default:
        return []
    }
  }

  return []
}
