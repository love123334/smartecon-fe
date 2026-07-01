import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/services'
import type { User, UserRole } from '@/types'
import { saveUserAvatar } from '@/utils/avatar'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isLoggedIn = computed(() => user.value != null)
  const role = computed<UserRole>(() => user.value?.role ?? 'guest')

  async function hydrate() {
    loading.value = true
    error.value = null
    try {
      user.value = await authApi.getCurrentUser()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Lỗi tải phiên'
    } finally {
      loading.value = false
    }
  }

  async function login(email: string, password: string) {
    loading.value = true
    error.value = null
    try {
      user.value = await authApi.login(email, password)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Đăng nhập thất bại'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function register(data: {
    email: string
    password: string
    fullName: string
    phone?: string
  }) {
    loading.value = true
    error.value = null
    try {
      user.value = await authApi.register(data)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Đăng ký thất bại'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await authApi.logout()
    user.value = null
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
    logout,
    updateProfile,
  }
})
