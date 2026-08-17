import { apiConfig } from '@/api/config'
import { localizeApiMessage } from '@/utils/apiMessage'

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

function authHeaders(withJsonContentType = false): HeadersInit {
  const token = localStorage.getItem('sedsp_access_token')
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (withJsonContentType) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

/** Default for normal API calls. Heavy dashboards / payments override timeoutMs. */
const DEFAULT_TIMEOUT_MS = 8_000

const CONNECTIVITY_ERROR =
  'Không kết nối được backend. Kiểm tra VITE_API_BASE_URL / VITE_BACKEND_ORIGIN.'

/** `/api/v1` → `/api` (một số DSS endpoint không nằm dưới v1). */
export function apiRootWithoutVersion(): string {
  const base = apiConfig.baseUrl.replace(/\/$/, '')
  // Absolute or relative URL ending in /v1|/v2 → strip version segment
  if (/\/v\d+$/i.test(base)) return base.replace(/\/v\d+$/i, '')
  // Absolute base without version (e.g. https://api.example.com/api) — keep same host
  if (/^https?:\/\//i.test(base)) return base
  // Relative path like /api — same-origin via Vite proxy
  if (base.startsWith('/')) return base || '/api'
  return `${apiConfig.backendOrigin.replace(/\/$/, '')}/api`
}

function mergeAbortSignals(
  timeoutSignal: AbortSignal,
  userSignal?: AbortSignal | null,
): AbortSignal {
  if (!userSignal) return timeoutSignal
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([timeoutSignal, userSignal])
  }
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (timeoutSignal.aborted || userSignal.aborted) {
    abort()
    return controller.signal
  }
  timeoutSignal.addEventListener('abort', abort, { once: true })
  userSignal.addEventListener('abort', abort, { once: true })
  return controller.signal
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
    const rawMsg =
      body && typeof body === 'object' && 'message' in body
        ? String((body as ApiResponse<unknown>).message)
        : res.statusText
    throw new ApiError(
      localizeApiMessage(rawMsg || fallbackMessage),
      res.status,
      body,
    )
  }

  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    const wrapped = body as ApiResponse<T>
    if (!wrapped.success) {
      throw new ApiError(localizeApiMessage(wrapped.message || 'API error'), res.status, body)
    }
    return wrapped.data
  }

  return body as T
}

export type ApiRequestConfig = {
  baseUrl?: string
  /** Override default request timeout (ms). */
  timeoutMs?: number
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  config?: ApiRequestConfig,
): Promise<T> {
  const root = (config?.baseUrl ?? apiConfig.baseUrl).replace(/\/$/, '')
  const url = `${root}/${path.replace(/^\//, '')}`
  const method = (options.method ?? 'GET').toUpperCase()
  const hasJsonBody =
    typeof options.body === 'string' &&
    ['POST', 'PUT', 'PATCH'].includes(method)
  let res: Response
  const timeoutMs = config?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    res = await fetch(url, {
      ...options,
      signal: mergeAbortSignals(controller.signal, options.signal),
      headers: { ...authHeaders(hasJsonBody), ...options.headers },
    })
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === 'AbortError'
    throw new ApiError(
      aborted
        ? 'Backend phản hồi chậm (timeout). Thử lại — nếu kéo dài, kiểm tra Railway API.'
        : CONNECTIVITY_ERROR,
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
  const headers = authHeaders(false) as Record<string, string>

  let res: Response
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60_000)
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    })
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === 'AbortError'
    throw new ApiError(
      aborted ? 'Upload timeout — backend không phản hồi.' : CONNECTIVITY_ERROR,
      0,
    )
  } finally {
    clearTimeout(timeoutId)
  }

  const body = await parseJsonBody(res)
  return unwrapApiBody<T>(res, body, 'Upload failed')
}

export const http = {
  get: <T>(path: string, config?: ApiRequestConfig) => apiRequest<T>(path, {}, config),
  post: <T>(path: string, data?: unknown, config?: ApiRequestConfig) =>
    apiRequest<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) }, config),
  /** POST tới base khác `/api/v1` (vd. `/api/dss/...`). */
  postAt: <T>(baseUrl: string, path: string, data?: unknown, config?: ApiRequestConfig) =>
    apiRequest<T>(
      path,
      { method: 'POST', body: JSON.stringify(data ?? {}) },
      { ...config, baseUrl },
    ),
  put: <T>(path: string, data?: unknown, config?: ApiRequestConfig) =>
    apiRequest<T>(path, { method: 'PUT', body: JSON.stringify(data ?? {}) }, config),
  patch: <T>(path: string, data?: unknown, config?: ApiRequestConfig) =>
    apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) }, config),
  delete: <T>(path: string, config?: ApiRequestConfig) =>
    apiRequest<T>(path, { method: 'DELETE' }, config),
  upload: <T>(path: string, formData: FormData) => apiUpload<T>(path, formData),
}
