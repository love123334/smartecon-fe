<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatVnd, orderApi } from '@/api/services'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import QuantityStepper from '@/components/QuantityStepper.vue'
import CheckoutStepper from '@/components/CheckoutStepper.vue'
import NewsletterBanner from '@/components/NewsletterBanner.vue'

const auth = useAuthStore()
const cart = useCartStore()
const router = useRouter()

const firstName = ref('')
const lastName = ref('')
const phone = ref('')
const email = ref('')
const address = ref('')
const city = ref('')
const state = ref('')
const zip = ref('')
const payment = ref<'card' | 'cod' | 'bank'>('cod')
const coupon = ref('')
const couponApplied = ref(false)
const error = ref('')
const loading = ref(false)

const shippingFee = computed(() => (cart.total >= 500_000 ? 0 : 30_000))
const discount = computed(() => (couponApplied.value ? 25_000 : 0))
const grandTotal = computed(() => Math.max(0, cart.total + shippingFee.value - discount.value))

onMounted(async () => {
  await cart.refresh()
  if (auth.user) {
    const parts = (auth.user.fullName ?? '').trim().split(/\s+/)
    lastName.value = parts.pop() ?? ''
    firstName.value = parts.join(' ')
    address.value = auth.user.address ?? ''
    phone.value = auth.user.phone ?? ''
    email.value = auth.user.email ?? ''
  }
})

function applyCoupon() {
  if (coupon.value.trim().toUpperCase() === 'SEDSP30') {
    couponApplied.value = true
  }
}

async function placeOrder() {
  if (!auth.user) return
  if (!address.value.trim()) {
    error.value = 'Vui lòng nhập địa chỉ giao hàng'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const fullAddress = [address.value, city.value, state.value, zip.value].filter(Boolean).join(', ')
    const order = await orderApi.placeOrder(auth.user.id, fullAddress || address.value)
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
  <div class="elegant-page">
    <div class="container elegant-page__inner">
      <h1 class="elegant-page-title">Thanh toán</h1>
      <CheckoutStepper :step="2" />

      <p v-if="!cart.lines.length" class="empty">
        Giỏ hàng trống. <RouterLink to="/">Tiếp tục mua</RouterLink>
      </p>

      <div v-else class="elegant-checkout">
        <div class="elegant-checkout__forms">
          <p v-if="error" class="elegant-alert elegant-alert--error">{{ error }}</p>

          <section class="elegant-form-section">
            <h2>Thông tin liên hệ</h2>
            <div class="elegant-form-grid elegant-form-grid--2">
              <div class="elegant-field">
                <label for="firstName">Họ</label>
                <input id="firstName" v-model="firstName" type="text" placeholder="Nguyễn" />
              </div>
              <div class="elegant-field">
                <label for="lastName">Tên</label>
                <input id="lastName" v-model="lastName" type="text" placeholder="Văn A" />
              </div>
              <div class="elegant-field">
                <label for="phone">Số điện thoại</label>
                <input id="phone" v-model="phone" type="tel" placeholder="0901234567" />
              </div>
              <div class="elegant-field">
                <label for="email">Email</label>
                <input id="email" v-model="email" type="email" placeholder="email@example.com" />
              </div>
            </div>
          </section>

          <section class="elegant-form-section">
            <h2>Địa chỉ giao hàng</h2>
            <div class="elegant-form-grid">
              <div class="elegant-field">
                <label for="addr">Địa chỉ</label>
                <input id="addr" v-model="address" type="text" placeholder="Số nhà, đường, phường..." required />
              </div>
              <div class="elegant-form-grid elegant-form-grid--3">
                <div class="elegant-field">
                  <label for="city">Thành phố</label>
                  <input id="city" v-model="city" type="text" placeholder="TP.HCM" />
                </div>
                <div class="elegant-field">
                  <label for="state">Quận/Huyện</label>
                  <input id="state" v-model="state" type="text" placeholder="Quận 1" />
                </div>
                <div class="elegant-field">
                  <label for="zip">Mã bưu điện</label>
                  <input id="zip" v-model="zip" type="text" placeholder="700000" />
                </div>
              </div>
            </div>
          </section>

          <section class="elegant-form-section">
            <h2>Phương thức thanh toán</h2>
            <label class="elegant-payment" :class="{ 'elegant-payment--active': payment === 'card' }">
              <input v-model="payment" type="radio" value="card" name="pay" />
              <span>Thẻ tín dụng / ghi nợ</span>
            </label>
            <div v-if="payment === 'card'" class="elegant-payment-fields">
              <div class="elegant-field">
                <label for="card">Số thẻ</label>
                <input id="card" type="text" placeholder="1234 5678 9012 3456" />
              </div>
              <div class="elegant-form-grid elegant-form-grid--2">
                <div class="elegant-field">
                  <label for="exp">Hết hạn (MM/YY)</label>
                  <input id="exp" type="text" placeholder="12/28" />
                </div>
                <div class="elegant-field">
                  <label for="cvc">CVC</label>
                  <input id="cvc" type="text" placeholder="123" />
                </div>
              </div>
            </div>
            <label class="elegant-payment" :class="{ 'elegant-payment--active': payment === 'cod' }">
              <input v-model="payment" type="radio" value="cod" name="pay" />
              <span>Thanh toán khi nhận hàng (COD)</span>
            </label>
            <label class="elegant-payment" :class="{ 'elegant-payment--active': payment === 'bank' }">
              <input v-model="payment" type="radio" value="bank" name="pay" />
              <span>Chuyển khoản ngân hàng</span>
            </label>
          </section>

          <button
            type="button"
            class="btn-elegant-primary btn-block btn-interactive elegant-checkout__submit"
            :disabled="loading"
            @click="placeOrder"
          >
            {{ loading ? 'Đang xử lý...' : 'Đặt hàng' }}
          </button>
        </div>

        <aside class="elegant-order-summary">
          <h2 class="elegant-summary__title">Tóm tắt đơn hàng</h2>

          <ul class="elegant-order-items">
            <li v-for="line in cart.lines" :key="line.product.id" class="elegant-order-item">
              <img :src="line.product.imageUrl" :alt="line.product.name" />
              <div class="elegant-order-item__info">
                <div class="elegant-order-item__name">{{ line.product.name }}</div>
                <div class="elegant-order-item__meta">{{ line.product.category }}</div>
                <QuantityStepper
                  variant="pill"
                  :model-value="line.quantity"
                  :min="1"
                  :max="line.product.stock"
                  @update:model-value="cart.setQuantity(line.product.id, $event)"
                />
              </div>
              <strong>{{ formatVnd(line.subtotal) }}</strong>
            </li>
          </ul>

          <div class="elegant-coupon__form elegant-coupon__form--compact">
            <input v-model="coupon" type="text" placeholder="Mã giảm giá" />
            <button type="button" class="btn-elegant-primary btn-interactive" @click="applyCoupon">Áp dụng</button>
          </div>
          <p v-if="couponApplied" class="elegant-coupon-applied">
            SEDSP30 <span>-{{ formatVnd(discount) }}</span>
            <button type="button" class="btn-interactive" @click="couponApplied = false">[Xóa]</button>
          </p>

          <div class="elegant-summary__rows">
            <div class="elegant-summary__row">
              <span>Vận chuyển</span>
              <span>{{ shippingFee === 0 ? 'Miễn phí' : formatVnd(shippingFee) }}</span>
            </div>
            <div class="elegant-summary__row">
              <span>Tạm tính</span>
              <span>{{ formatVnd(cart.total) }}</span>
            </div>
            <div v-if="discount" class="elegant-summary__row elegant-summary__row--discount">
              <span>Giảm giá</span>
              <span>-{{ formatVnd(discount) }}</span>
            </div>
          </div>

          <div class="elegant-summary__total">
            <span>Tổng</span>
            <strong>{{ formatVnd(grandTotal) }}</strong>
          </div>
        </aside>
      </div>
    </div>

    <NewsletterBanner />
  </div>
</template>
