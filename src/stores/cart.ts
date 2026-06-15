import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  cartApi,
  resolveCartLines,
  type CartLine,
} from '@/api/services'
import { useAuthStore } from '@/stores/auth'

export const useCartStore = defineStore('cart', () => {
  const lines = ref<CartLine[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const drawerOpen = ref(false)

  const itemCount = computed(() =>
    lines.value.reduce((s, l) => s + l.quantity, 0),
  )
  const total = computed(() =>
    lines.value.reduce((s, l) => s + l.subtotal, 0),
  )

  async function refresh() {
    const auth = useAuthStore()
    if (!auth.user || auth.role !== 'customer') {
      lines.value = []
      return
    }
    loading.value = true
    error.value = null
    try {
      lines.value = await resolveCartLines(auth.user.id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Lỗi giỏ hàng'
    } finally {
      loading.value = false
    }
  }

  async function add(productId: string, qty = 1) {
    const auth = useAuthStore()
    if (!auth.user) throw new Error('Vui lòng đăng nhập')
    loading.value = true
    error.value = null
    try {
      await cartApi.addItem(auth.user.id, productId, qty)
      await refresh()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Không thêm được'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function setQuantity(productId: string, quantity: number) {
    const auth = useAuthStore()
    if (!auth.user) return
    loading.value = true
    try {
      await cartApi.updateQuantity(auth.user.id, productId, quantity)
      await refresh()
    } finally {
      loading.value = false
    }
  }

  async function remove(productId: string) {
    const auth = useAuthStore()
    if (!auth.user) return
    await cartApi.removeItem(auth.user.id, productId)
    await refresh()
  }

  function openDrawer() {
    drawerOpen.value = true
    void refresh()
  }

  function closeDrawer() {
    drawerOpen.value = false
  }

  return {
    lines,
    loading,
    error,
    drawerOpen,
    itemCount,
    total,
    refresh,
    add,
    setQuantity,
    remove,
    openDrawer,
    closeDrawer,
  }
})
