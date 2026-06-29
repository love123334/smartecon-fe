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
    byProduct: (id: string) => `inventory/${id}`,
    update: (id: string) => `inventory/${id}`,
  },
  cart: {
    mine: 'cart',
    items: 'cart/items',
    item: (itemId: string) => `cart/items/${itemId}`,
  },
  orders: {
    list: 'orders',
    byId: (id: string) => `orders/${id}`,
    cancel: (id: string) => `orders/${id}/cancel`,
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
