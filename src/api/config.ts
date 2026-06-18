/** Cấu hình kết nối backend Spring Boot (`backend/`) */
export const apiConfig = {
  /** true = mock toàn bộ; false = auth/profile từ backend, catalog vẫn mock */
  useMock: import.meta.env.VITE_USE_MOCK !== 'false',
  useRealAuth: import.meta.env.VITE_USE_MOCK === 'false',
  /** Base URL — Vite proxy `/api` → :8080 → `/api/v1/...` */
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  backendOrigin: import.meta.env.VITE_BACKEND_ORIGIN ?? 'http://localhost:8080',
} as const
