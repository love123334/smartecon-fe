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
  /** Local edits (qty/remove) not yet pushed to API — synced at checkout. */
  const dirty = ref(false)
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

  function patchLineLocally(productId: string, quantity: number) {
    const idx = lines.value.findIndex((l) => l.product.id === productId)
    if (idx < 0) return
    if (quantity <= 0) {
      lines.value = lines.value.filter((l) => l.product.id !== productId)
      dirty.value = true
      return
    }
    const line = lines.value[idx]
    lines.value[idx] = {
      ...line,
      quantity,
      subtotal: line.product.price * quantity,
    }
    dirty.value = true
  }

  async function refresh(options?: { enrichCatalog?: boolean }) {
    const auth = useAuthStore()
    if (!auth.user || !canShopAsBuyer(auth.role)) {
      lines.value = []
      dirty.value = false
      return
    }
    loading.value = true
    error.value = null
    try {
      lines.value = await resolveCartLines(auth.user.id, {
        enrichCatalog: options?.enrichCatalog,
      })
      dirty.value = false
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Lỗi giỏ hàng'
    } finally {
      loading.value = false
    }
  }

  async function syncToServer() {
    const auth = useAuthStore()
    if (!auth.user || !canShopAsBuyer(auth.role) || !dirty.value) return

    const userId = auth.user.id
    const serverItems = await cartApi.getCart(userId)
    const localIds = new Set(lines.value.map((l) => l.product.id))
    const serverByProduct = new Map(serverItems.map((i) => [i.productId, i]))

    for (const item of serverItems) {
      if (!localIds.has(item.productId)) {
        await cartApi.removeItem(userId, item.productId)
      }
    }

    for (const line of lines.value) {
      const serverItem = serverByProduct.get(line.product.id)
      if (!serverItem) {
        await cartApi.addItem(userId, line.product.id, line.quantity)
      } else if (serverItem.quantity !== line.quantity) {
        await cartApi.updateQuantity(userId, line.product.id, line.quantity)
      }
    }

    dirty.value = false
  }

  /** Push pending local edits then reload full cart (stock, seller, images). */
  async function prepareForCheckout() {
    const auth = useAuthStore()
    if (!auth.user || !canShopAsBuyer(auth.role)) return
    loading.value = true
    error.value = null
    try {
      await syncToServer()
      lines.value = await resolveCartLines(auth.user.id, { enrichCatalog: true })
      dirty.value = false
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Lỗi đồng bộ giỏ hàng'
      throw e
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
      const fresh = await resolveCartLines(auth.user.id, { enrichCatalog: false })
      if (dirty.value) {
        const localQty = new Map(lines.value.map((l) => [l.product.id, l.quantity]))
        lines.value = fresh.map((line) => {
          const q = localQty.get(line.product.id)
          if (q == null) return line
          return { ...line, quantity: q, subtotal: line.product.price * q }
        })
      } else {
        lines.value = fresh
      }
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

  function setQuantity(productId: string, quantity: number) {
    patchLineLocally(productId, quantity)
  }

  function remove(productId: string) {
    patchLineLocally(productId, 0)
  }

  function openDrawer() {
    drawerOpen.value = true
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
    dirty,
    itemCount,
    total,
    refresh,
    syncToServer,
    prepareForCheckout,
    add,
    setQuantity,
    remove,
    openDrawer,
    closeDrawer,
    bounceCart,
  }
})
