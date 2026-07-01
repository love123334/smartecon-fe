import { apiConfig } from '@/api/config'

/** Định dạng response chuẩn backend (docs/project-architecture.md) */
export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('sedsp_access_token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${apiConfig.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
  let res: Response
  try {
    res = await fetch(url, {
      ...options,
      headers: { ...authHeaders(), ...options.headers },
    })
  } catch {
    throw new ApiError(
      'Không kết nối được backend. Hãy chạy Spring Boot tại localhost:8080 (hoặc dùng chế độ mock).',
      0,
    )
  }

  let body: ApiResponse<T> | unknown
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (!res.ok) {
    const msg =
      body && typeof body === 'object' && 'message' in body
        ? String((body as ApiResponse<unknown>).message)
        : res.statusText
    throw new ApiError(msg || 'Request failed', res.status, body)
  }

  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    const wrapped = body as ApiResponse<T>
    if (!wrapped.success) {
      throw new ApiError(wrapped.message || 'API error', res.status, body)
    }
    return wrapped.data
  }

  return body as T
}

export const http = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, data?: unknown) =>
    apiRequest<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  put: <T>(path: string, data?: unknown) =>
    apiRequest<T>(path, { method: 'PUT', body: JSON.stringify(data ?? {}) }),
  patch: <T>(path: string, data?: unknown) =>
    apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
}
