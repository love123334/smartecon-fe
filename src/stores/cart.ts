import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  cartApi,
  resolveCartLines,
  type CartLine,
} from '@/api/services'
import { useAuthStore } from '@/stores/auth'
import { isOutOfStockError, useNoticeStore } from '@/stores/notice'
import { canShopAsBuyer } from '@/utils/roleNav'

export const useCartStore = defineStore('cart', () => {
  const lines = ref<CartLine[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const drawerOpen = ref(false)
  const cartBounce = ref(false)
  let bounceTimer: ReturnType<typeof setTimeout> | null = null

  const itemCount = computed(() =>
    lines.value.reduce((s, l) => s + l.quantity, 0),
  )
  const total = computed(() =>
    lines.value.reduce((s, l) => s + l.subtotal, 0),
  )

  function bounceCart() {
    cartBounce.value = true
    if (bounceTimer) clearTimeout(bounceTimer)
    bounceTimer = setTimeout(() => {
      cartBounce.value = false
      bounceTimer = null
    }, 700)
  }

  async function refresh() {
    const auth = useAuthStore()
    if (!auth.user || !canShopAsBuyer(auth.role)) {
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
    if (!canShopAsBuyer(auth.role)) {
      throw new Error('Tài khoản hiện tại không thể mua hàng')
    }
    loading.value = true
    error.value = null
    try {
      await cartApi.addItem(auth.user.id, productId, qty)
      await refresh()
      bounceCart()
      openDrawer()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Không thêm được'
      if (isOutOfStockError(e)) {
        useNoticeStore().showOutOfStock()
      } else {
        useNoticeStore().show({
          kind: 'error',
          title: 'Không thêm được giỏ',
          message: error.value || 'Thử lại sau.',
        })
      }
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
    cartBounce,
    itemCount,
    total,
    refresh,
    add,
    setQuantity,
    remove,
    openDrawer,
    closeDrawer,
    bounceCart,
  }
})
