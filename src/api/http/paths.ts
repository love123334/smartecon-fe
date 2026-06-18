/**
 * Đường dẫn REST dự kiến — map với modules backend:
 * smart-ecommerce-dssp/src/.../modules/{auth,user,product,inventory,order,analytics}
 *
 * Khi backend implement, bật VITE_USE_MOCK=false và gọi qua http client.
 */
export const apiPaths = {
  auth: {
    login: 'auth/login',
    register: 'auth/register',
    logout: 'auth/logout',
    me: 'auth/me',
  },
  users: {
    list: 'users',
    profile: 'users/profile',
    byId: (id: string) => `users/${id}`,
    activate: (id: string) => `users/${id}/activate`,
    deactivate: (id: string) => `users/${id}/deactivate`,
    role: (id: string) => `users/${id}/role`,
  },
  products: {
    list: 'products',
    byId: (id: string) => `products/${id}`,
    search: 'products/search',
  },
  inventory: {
    byProduct: (id: string) => `inventory/products/${id}`,
    update: (id: string) => `inventory/products/${id}`,
  },
  cart: {
    mine: 'cart',
    items: 'cart/items',
    item: (productId: string) => `cart/items/${productId}`,
  },
  orders: {
    list: 'orders',
    mine: 'orders/me',
    byId: (id: string) => `orders/${id}`,
    checkout: 'orders/checkout',
    track: (id: string) => `orders/${id}/tracking`,
  },
  analytics: {
    sales: 'analytics/sales',
    revenue: 'analytics/revenue',
    trends: 'analytics/products/trends',
    customers: 'analytics/customers',
    kpi: 'analytics/kpi',
  },
  dss: {
    demand: (productId: string) => `dss/demand/${productId}`,
    price: (productId: string) => `dss/price/${productId}`,
    inventory: (productId: string) => `dss/inventory/${productId}`,
    whatIf: 'dss/what-if',
    insights: 'dss/insights',
  },
  ai: {
    recommendations: 'ai/recommendations',
    chat: 'ai/chat',
  },
  admin: {
    metrics: 'admin/metrics',
    logs: 'admin/logs',
  },
} as const
