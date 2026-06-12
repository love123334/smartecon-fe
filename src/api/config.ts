/** Cấu hình kết nối backend Spring Boot (smart-ecommerce-dssp) */
export const apiConfig = {
  /** true = localStorage mock; false = gọi REST API backend */
  useMock: import.meta.env.VITE_USE_MOCK !== 'false',
  /** Base URL — khớp proxy Vite /api hoặc URL deploy backend */
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  /** Backend gốc (Swagger, health) */
  backendOrigin: import.meta.env.VITE_BACKEND_ORIGIN ?? 'http://localhost:8080',
} as const
