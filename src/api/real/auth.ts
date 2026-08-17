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
import {
  clearUserSnapshot,
  readUserSnapshot,
  saveUserSnapshot,
} from '@/utils/sessionSnapshot'

function isAuthRejected(status: number): boolean {
  return status === 401 || status === 403
}

export async function login(email: string, password: string): Promise<User> {
  // Avoid sending a stale Bearer token on the public login call.
  clearAccessToken()
  clearUserSnapshot()

  const data = await http.post<BackendLoginResponse>(apiPaths.auth.login, {
    email: email.trim().toLowerCase(),
    password,
  })
  saveAccessToken(data.accessToken)

  try {
    const me = await http.get<BackendMeResponse>(apiPaths.auth.me)
    const user = mapBackendUser({
      ...me,
      role: me.role ?? data.user.role,
    })
    saveUserSnapshot(user)
    return user
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 0
    if (isAuthRejected(status)) {
      clearAccessToken()
      clearUserSnapshot()
      throw e
    }
    // /me lỗi tạm — vẫn giữ phiên từ payload login
    const user = mapBackendUser({
      id: data.user.id,
      email: data.user.email,
      username: data.user.username,
      role: data.user.role,
    })
    saveUserSnapshot(user)
    return user
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const token = localStorage.getItem('sedsp_access_token')
  if (!token) {
    clearUserSnapshot()
    return null
  }

  // Mock token — không gọi /auth/me
  if (token.startsWith('mock.')) {
    return readUserSnapshot()
  }

  const fetchMe = async () => {
    const me = await http.get<BackendMeResponse>(apiPaths.auth.me)
    const user = mapBackendUser(me)
    saveUserSnapshot(user)
    return user
  }

  try {
    return await fetchMe()
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 0
    if (isAuthRejected(status)) {
      clearAccessToken()
      clearUserSnapshot()
      return null
    }
    // Retry một lần cho lỗi tạm (network / 5xx)
    try {
      await new Promise((r) => setTimeout(r, 400))
      return await fetchMe()
    } catch (e2) {
      const status2 = e2 instanceof ApiError ? e2.status : 0
      if (isAuthRejected(status2)) {
        clearAccessToken()
        clearUserSnapshot()
        return null
      }
      // Giữ phiên từ snapshot nếu JWT vẫn còn
      const snap = readUserSnapshot()
      if (snap) return snap
      // Không wipe token — để hydrate / lần sau thử lại
      throw e2 instanceof Error ? e2 : new Error('Không tải được phiên đăng nhập')
    }
  }
}

export async function logout(): Promise<void> {
  clearAccessToken()
  clearUserSnapshot()
}

export async function updateProfile(
  _userId: string,
  patch: Partial<Pick<User, 'fullName' | 'phone' | 'address'>>,
): Promise<User> {
  const data = await http.put<BackendUserProfileResponse>(apiPaths.users.profile, {
    fullName: patch.fullName,
    phone: patch.phone,
  })
  const user = mapBackendUser(data)
  saveUserSnapshot(user)
  return user
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

export async function forgotPassword(email: string): Promise<void> {
  await http.post<void>(
    `${apiPaths.auth.forgotPassword}?email=${encodeURIComponent(email.trim().toLowerCase())}`,
    {},
  )
}

export async function verifyResetOtp(email: string, otp: string): Promise<void> {
  await http.post<void>(apiPaths.auth.verifyResetOtp, {
    email: email.trim().toLowerCase(),
    otp: otp.trim(),
  })
}

export async function updatePassword(
  email: string,
  newPassword: string,
  confirmPassword: string,
): Promise<void> {
  await http.post<void>(apiPaths.auth.updatePassword, {
    email: email.trim().toLowerCase(),
    newPassword,
    confirmPassword,
  })
}
