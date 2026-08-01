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

const DEFAULT_TIMEOUT_MS = 25_000

/** `/api/v1` → `/api` (một số DSS endpoint không nằm dưới v1). */
export function apiRootWithoutVersion(): string {
  const base = apiConfig.baseUrl.replace(/\/$/, '')
  if (/\/v1$/i.test(base)) return base.replace(/\/v1$/i, '')
  return `${apiConfig.backendOrigin.replace(/\/$/, '')}/api`
}

async function parseJsonBody(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

function unwrapApiBody<T>(res: Response, body: unknown, fallbackMessage: string): T {
  if (!res.ok) {
    const msg =
      body && typeof body === 'object' && 'message' in body
        ? String((body as ApiResponse<unknown>).message)
        : res.statusText
    throw new ApiError(msg || fallbackMessage, res.status, body)
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

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  config?: { baseUrl?: string },
): Promise<T> {
  const root = (config?.baseUrl ?? apiConfig.baseUrl).replace(/\/$/, '')
  const url = `${root}/${path.replace(/^\//, '')}`
  let res: Response
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  try {
    res = await fetch(url, {
      ...options,
      signal: options.signal ?? controller.signal,
      headers: { ...authHeaders(), ...options.headers },
    })
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === 'AbortError'
    throw new ApiError(
      aborted
        ? 'Backend không phản hồi (timeout). Kiểm tra Railway API đang chạy.'
        : 'Không kết nối được backend. Kiểm tra VITE_API_BASE_URL hoặc chạy Spring Boot tại localhost:8080.',
      0,
    )
  } finally {
    clearTimeout(timeoutId)
  }

  const body = await parseJsonBody(res)
  return unwrapApiBody<T>(res, body, 'Request failed')
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const url = `${apiConfig.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
  const token = localStorage.getItem('sedsp_access_token')
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(url, { method: 'POST', headers, body: formData })
  } catch {
    throw new ApiError(
      'Không kết nối được backend. Hãy chạy Spring Boot tại localhost:8080.',
      0,
    )
  }

  const body = await parseJsonBody(res)
  return unwrapApiBody<T>(res, body, 'Upload failed')
}

export const http = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, data?: unknown) =>
    apiRequest<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  /** POST tới base khác `/api/v1` (vd. `/api/dss/...`). */
  postAt: <T>(baseUrl: string, path: string, data?: unknown) =>
    apiRequest<T>(
      path,
      { method: 'POST', body: JSON.stringify(data ?? {}) },
      { baseUrl },
    ),
  put: <T>(path: string, data?: unknown) =>
    apiRequest<T>(path, { method: 'PUT', body: JSON.stringify(data ?? {}) }),
  patch: <T>(path: string, data?: unknown) =>
    apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => apiUpload<T>(path, formData),
}
