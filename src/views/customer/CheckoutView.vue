<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatVnd, orderApi } from '@/api/services'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'

const auth = useAuthStore()
const cart = useCartStore()
const router = useRouter()
const address = ref('')
const phone = ref('')
const payment = ref<'cod' | 'bank'>('cod')
const error = ref('')
const loading = ref(false)

const shippingFee = computed(() => (cart.total >= 500_000 ? 0 : 30_000))
const grandTotal = computed(() => cart.total + shippingFee.value)

onMounted(async () => {
  await cart.refresh()
  address.value = auth.user?.address ?? ''
  phone.value = auth.user?.phone ?? ''
})

async function placeOrder() {
  if (!auth.user) return
  if (!address.value.trim()) {
    error.value = 'Vui lòng nhập địa chỉ giao hàng'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const order = await orderApi.placeOrder(auth.user.id, address.value)
    await cart.refresh()
    router.push(`/orders/${order.id}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Đặt hàng thất bại'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <nav class="mkt-breadcrumb">
      <RouterLink to="/">Trang chủ</RouterLink>
      <span>/</span>
      <RouterLink to="/cart">Giỏ hàng</RouterLink>
      <span>/</span>
      <span>Thanh toán</span>
    </nav>

    <h1 class="page-title" style="font-size: 1.25rem; margin-bottom: 1rem">Thanh toán</h1>

    <p v-if="!cart.lines.length" class="empty">
      Giỏ hàng trống. <RouterLink to="/">Tiếp tục mua</RouterLink>
    </p>

    <div v-else class="mkt-checkout">
      <div>
        <p v-if="error" class="alert alert-error">{{ error }}</p>

        <section class="mkt-checkout__section">
          <h2>📍 Địa chỉ nhận hàng</h2>
          <div class="form-group">
            <label for="phone">Số điện thoại</label>
            <input id="phone" v-model="phone" type="tel" placeholder="0901234567" />
          </div>
          <div class="form-group" style="margin-bottom: 0">
            <label for="addr">Địa chỉ chi tiết</label>
            <textarea id="addr" v-model="address" rows="3" placeholder="Số nhà, đường, phường, quận, tỉnh/thành" required />
          </div>
        </section>

        <section class="mkt-checkout__section">
          <h2>📦 Sản phẩm đặt mua</h2>
          <div
            v-for="line in cart.lines"
            :key="line.product.id"
            style="display: flex; gap: 0.75rem; padding: 0.65rem 0; border-bottom: 1px solid var(--slate-50)"
          >
            <img
              :src="line.product.imageUrl"
              :alt="line.product.name"
              style="width: 56px; height: 56px; object-fit: cover; border-radius: 4px"
            />
            <div style="flex: 1">
              <div style="font-size: 0.875rem">{{ line.product.name }}</div>
              <div class="muted">x{{ line.quantity }}</div>
            </div>
            <strong style="color: var(--primary-700); font-size: 0.875rem">
              {{ formatVnd(line.subtotal) }}
            </strong>
          </div>
        </section>

        <section class="mkt-checkout__section">
          <h2>💳 Phương thức thanh toán</h2>
          <label
            class="mkt-payment-option"
            :class="{ 'mkt-payment-option--active': payment === 'cod' }"
          >
            <input v-model="payment" type="radio" value="cod" name="payment" />
            <span>Thanh toán khi nhận hàng (COD)</span>
          </label>
          <label
            class="mkt-payment-option"
            :class="{ 'mkt-payment-option--active': payment === 'bank' }"
          >
            <input v-model="payment" type="radio" value="bank" name="payment" />
            <span>Chuyển khoản ngân hàng (mock)</span>
          </label>
        </section>
      </div>

      <aside class="mkt-cart-summary">
        <h3 style="margin: 0 0 1rem; font-size: 1rem">Tóm tắt đơn hàng</h3>
        <div class="mkt-cart-summary__row">
          <span>Tạm tính</span>
          <span>{{ formatVnd(cart.total) }}</span>
        </div>
        <div class="mkt-cart-summary__row">
          <span>Phí vận chuyển</span>
          <span>{{ shippingFee === 0 ? 'Miễn phí' : formatVnd(shippingFee) }}</span>
        </div>
        <hr style="border: none; border-top: 1px solid var(--slate-100); margin: 0.75rem 0" />
        <div class="mkt-cart-summary__row">
          <span>Tổng cộng</span>
          <span class="mkt-cart-summary__total">{{ formatVnd(grandTotal) }}</span>
        </div>
        <button
          type="button"
          class="btn btn-primary btn-block"
          style="margin-top: 1rem"
          :disabled="loading"
          @click="placeOrder"
        >
          {{ loading ? 'Đang xử lý...' : 'Đặt hàng' }}
        </button>
      </aside>
    </div>
  </div>
</template>
