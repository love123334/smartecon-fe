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
    resendOtp: 'auth/resend-otp',
    verifyEmail: 'auth/verify-email',
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
    priceHistory: (id: string) => `products/${id}/price-history`,
    imageUpload: 'products/images/upload',
  },
  reviews: {
    list: (productId: string) => `products/${productId}/reviews`,
    summary: (productId: string) => `products/${productId}/reviews/summary`,
    byId: (productId: string, reviewId: string) => `products/${productId}/reviews/${reviewId}`,
  },
  seller: {
    dashboard: 'seller/dashboard',
    salesPerformance: 'seller/sales-performance',
  },
  categories: {
    list: 'categories',
    tree: 'categories/tree',
    byId: (id: string) => `categories/${id}`,
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
    seller: 'orders/seller',
    manage: 'orders/manage',
    byId: (id: string) => `orders/${id}`,
    cancel: (id: string) => `orders/${id}/cancel`,
    status: (id: string) => `orders/${id}/status`,
  },
  payments: {
    list: 'payments',
    byOrder: (orderId: string) => `payments/orders/${orderId}`,
    payOrder: (orderId: string) => `payments/orders/${orderId}`,
    status: (paymentId: string) => `payments/${paymentId}/status`,
  },
  analytics: {
    sales: 'analytics/sales',
    revenue: 'analytics/revenue',
    trends: 'analytics/products/trends',
    customers: 'analytics/customers',
    kpi: 'analytics/kpi',
    powerBiSales: 'analytics/powerbi/sales',
  },
  dss: {
    demand: (productId: string) => `dss/demand/${productId}`,
    price: (productId: string) => `dss/price/${productId}`,
    inventory: 'dss/inventory',
    whatIf: 'dss/what-if',
    insights: 'dss/insights',
    insightsPlan: 'dss/insights/plan',
  },
  ai: {
    recommendations: 'ai/recommendations',
    chat: 'ai/chat',
    status: 'ai/status',
  },
  admin: {
    metrics: 'admin/metrics',
    logs: 'admin/logs',
  },
} as const
