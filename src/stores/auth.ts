import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/services'
import type { User, UserRole } from '@/types'
import { saveUserAvatar } from '@/utils/avatar'
import { clearUserSnapshot, readUserSnapshot, saveUserSnapshot } from '@/utils/sessionSnapshot'
import { useChatSessionStore } from '@/stores/chatSession'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isLoggedIn = computed(() => user.value != null)
  const role = computed<UserRole>(() => user.value?.role ?? 'guest')

  let hydratePromise: Promise<void> | null = null

  async function hydrate() {
    if (hydratePromise) return hydratePromise
    hydratePromise = (async () => {
      loading.value = true
      error.value = null
      try {
        const next = await authApi.getCurrentUser()
        if (next) {
          user.value = next
          saveUserSnapshot(next)
          return
        }
        // Không có user từ API — chỉ logout nếu không còn JWT
        const token = localStorage.getItem('sedsp_access_token')
        if (!token) {
          user.value = null
          clearUserSnapshot()
          return
        }
        // JWT còn nhưng /me fail → giữ snapshot / user hiện tại
        const snap = readUserSnapshot()
        if (snap) user.value = snap
        else if (!user.value) user.value = null
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Lỗi tải phiên'
        const token = localStorage.getItem('sedsp_access_token')
        if (token) {
          const snap = readUserSnapshot()
          if (snap) user.value = snap
        } else {
          user.value = null
          clearUserSnapshot()
        }
      } finally {
        loading.value = false
        hydratePromise = null
      }
    })()
    return hydratePromise
  }

  async function login(email: string, password: string) {
    loading.value = true
    error.value = null
    try {
      user.value = await authApi.login(email, password)
      if (user.value) saveUserSnapshot(user.value)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Đăng nhập thất bại'
      throw e
    } finally {
      loading.value = false
    }
  }

  /** Trả về pending_verification nếu backend yêu cầu OTP email */
  async function register(data: {
    email: string
    password: string
    fullName: string
    phone?: string
  }) {
    loading.value = true
    error.value = null
    try {
      const result = await authApi.register(data)
      if (result.status === 'active') {
        user.value = result.user
        saveUserSnapshot(result.user)
      }
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Đăng ký thất bại'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function resendOtp(email: string) {
    await authApi.resendOtp(email)
  }

  async function verifyEmail(email: string, otp: string) {
    await authApi.verifyEmail(email, otp)
  }

  async function logout() {
    await authApi.logout()
    user.value = null
    clearUserSnapshot()
    try {
      useChatSessionStore().resetSession()
    } catch {
      /* pinia chưa mount */
    }
  }

  async function updateProfile(
    patch: Partial<Pick<User, 'fullName' | 'phone' | 'address' | 'avatarPreset' | 'avatarUrl'>>,
  ) {
    if (!user.value) return
    if (patch.avatarPreset !== undefined || patch.avatarUrl !== undefined) {
      saveUserAvatar(user.value.id, {
        avatarPreset: patch.avatarPreset ?? user.value.avatarPreset,
        avatarUrl: patch.avatarUrl ?? user.value.avatarUrl,
      })
    }
    user.value = await authApi.updateProfile(user.value.id, patch)
    if (user.value) saveUserSnapshot(user.value)
  }

  /** Áp role override ngay (sau khi được duyệt seller/manager) */
  function applyLocalRole(role: UserRole) {
    if (!user.value) return
    user.value = { ...user.value, role }
    saveUserSnapshot(user.value)
  }

  return {
    user,
    loading,
    error,
    isLoggedIn,
    role,
    hydrate,
    login,
    register,
    resendOtp,
    verifyEmail,
    logout,
    updateProfile,
    applyLocalRole,
  }
})
