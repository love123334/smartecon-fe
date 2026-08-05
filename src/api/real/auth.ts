import { ApiError, http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'
import type { User } from '@/types'
import {
  mapBackendUser,
  saveAccessToken,
  clearAccessToken,
  type BackendLoginResponse,
  type BackendMeResponse,
  type BackendUserProfileResponse,
} from '@/api/real/mappers'

export async function login(email: string, password: string): Promise<User> {
  const data = await http.post<BackendLoginResponse>(apiPaths.auth.login, {
    email,
    password,
  })
  saveAccessToken(data.accessToken)

  try {
    const me = await http.get<BackendMeResponse>(apiPaths.auth.me)
    return mapBackendUser({
      ...me,
      role: me.role ?? data.user.role,
    })
  } catch {
    return mapBackendUser({
      id: data.user.id,
      email: data.user.email,
      username: data.user.username,
      role: data.user.role,
    })
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const token = localStorage.getItem('sedsp_access_token')
  if (!token) return null

  const fetchMe = async () => {
    const me = await http.get<BackendMeResponse>(apiPaths.auth.me)
    return mapBackendUser(me)
  }

  try {
    return await fetchMe()
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 0
    // Only wipe JWT on real auth rejection — keep session across network blips
    // (VNPay return reload + brief /auth/me timeout must not log the user out)
    if (status === 401 || status === 403) {
      clearAccessToken()
      return null
    }
    // One retry for transient failures right after payment-gateway return
    try {
      await new Promise((r) => setTimeout(r, 450))
      return await fetchMe()
    } catch (e2) {
      const status2 = e2 instanceof ApiError ? e2.status : 0
      if (status2 === 401 || status2 === 403) {
        clearAccessToken()
      }
      return null
    }
  }
}

export async function logout(): Promise<void> {
  clearAccessToken()
}

export async function updateProfile(
  _userId: string,
  patch: Partial<Pick<User, 'fullName' | 'phone' | 'address'>>,
): Promise<User> {
  const data = await http.put<BackendUserProfileResponse>(apiPaths.users.profile, {
    fullName: patch.fullName,
    phone: patch.phone,
  })
  return mapBackendUser(data)
}

export type RegisterResult =
  | { status: 'active'; user: User }
  | { status: 'pending_verification'; email: string; message: string }

/**
 * Backend register tạo CUSTOMER + PENDING (OTP email).
 * Không auto-login — tránh DisabledException / race sau khi tạo PENDING.
 */
export async function register(data: {
  email: string
  password: string
  fullName: string
}): Promise<RegisterResult> {
  await http.post<void>(apiPaths.auth.register, {
    fullName: data.fullName,
    email: data.email.trim().toLowerCase(),
    password: data.password,
    confirmPassword: data.password,
  })

  return {
    status: 'pending_verification',
    email: data.email.trim().toLowerCase(),
    message:
      'Đăng ký thành công. Kiểm tra Hộp thư đến và Spam để lấy mã OTP, rồi nhập bên dưới để kích hoạt.',
  }
}

export async function resendOtp(email: string): Promise<void> {
  await http.post<void>(`${apiPaths.auth.resendOtp}?email=${encodeURIComponent(email)}`, {})
}

export async function verifyEmail(email: string, otp: string): Promise<void> {
  await http.post<void>(apiPaths.auth.verifyEmail, {
    email: email.trim().toLowerCase(),
    otp: otp.trim(),
  })
}
