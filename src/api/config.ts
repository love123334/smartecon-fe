/** Cấu hình kết nối backend Spring Boot (`backend/`) */
export const apiConfig = {
  /** true = mock toàn bộ */
  useMock: import.meta.env.VITE_USE_MOCK === 'true',
  /** Auth + profile từ backend khi không mock */
  useRealAuth: import.meta.env.VITE_USE_MOCK !== 'true',
  /** Catalog sản phẩm từ GET /api/v1/products (public) */
  useRealProducts: import.meta.env.VITE_USE_MOCK !== 'true',
  /** Giỏ hàng từ /api/v1/cart (JWT) */
  useRealCart: import.meta.env.VITE_USE_MOCK !== 'true',
  /** Đơn hàng từ /api/v1/orders */
  useRealOrders: import.meta.env.VITE_USE_MOCK !== 'true',
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  backendOrigin: import.meta.env.VITE_BACKEND_ORIGIN ?? 'http://localhost:8080',
} as const
