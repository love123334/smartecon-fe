import { http } from '@/api/http/client'
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
  try {
    const me = await http.get<BackendMeResponse>(apiPaths.auth.me)
    return mapBackendUser(me)
  } catch {
    clearAccessToken()
    return null
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

/** Backend register — role CUSTOMER mặc định */
export async function register(data: {
  email: string
  password: string
  fullName: string
}): Promise<User> {
  await http.post<void>(apiPaths.auth.register, {
    fullName: data.fullName,
    email: data.email,
    password: data.password,
    confirmPassword: data.password,
  })
  return login(data.email, data.password)
}
