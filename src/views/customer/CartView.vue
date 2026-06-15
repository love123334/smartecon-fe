<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatVnd } from '@/api/services'
import { useCartStore } from '@/stores/cart'
import QuantityStepper from '@/components/QuantityStepper.vue'
import CheckoutStepper from '@/components/CheckoutStepper.vue'
import EmptyState from '@/components/EmptyState.vue'
import NewsletterBanner from '@/components/NewsletterBanner.vue'

const cart = useCartStore()
const router = useRouter()
const shipping = ref<'free' | 'express' | 'pickup'>('free')
const coupon = ref('')
const couponApplied = ref(false)

const shippingFee = computed(() => {
  if (shipping.value === 'express') return 35_000
  if (shipping.value === 'pickup') return 0
  return cart.total >= 500_000 ? 0 : 30_000
})

const discount = computed(() => (couponApplied.value ? 25_000 : 0))
const grandTotal = computed(() => Math.max(0, cart.total + shippingFee.value - discount.value))

onMounted(() => cart.refresh())

function checkout() {
  router.push('/checkout')
}

function applyCoupon() {
  if (coupon.value.trim().toUpperCase() === 'SEDSP30') {
    couponApplied.value = true
  }
}
</script>

<template>
  <div class="elegant-page">
    <div class="container elegant-page__inner">
      <h1 class="elegant-page-title">Giỏ hàng</h1>
      <CheckoutStepper :step="1" />

      <p v-if="cart.loading" class="empty">Đang tải...</p>
      <EmptyState
        v-else-if="!cart.lines.length"
        icon="🛒"
        title="Giỏ hàng trống"
        description="Khám phá sản phẩm và thêm vào giỏ nhé!"
      >
        <RouterLink to="/" class="btn-elegant-primary btn-interactive" style="margin-top: 1rem; display: inline-flex">
          Mua sắm ngay
        </RouterLink>
      </EmptyState>

      <div v-else class="elegant-cart">
        <div class="elegant-cart__main">
          <div class="elegant-cart-table">
            <div class="elegant-cart-table__head">
              <span>Sản phẩm</span>
              <span>Số lượng</span>
              <span>Đơn giá</span>
              <span>Thành tiền</span>
            </div>
            <div v-for="line in cart.lines" :key="line.product.id" class="elegant-cart-row">
              <div class="elegant-cart-row__product">
                <img :src="line.product.imageUrl" :alt="line.product.name" />
                <div>
                  <div class="elegant-cart-row__name">{{ line.product.name }}</div>
                  <div class="elegant-cart-row__meta">Loại: {{ line.product.category }}</div>
                  <button
                    type="button"
                    class="elegant-cart-row__remove btn-interactive"
                    @click="cart.remove(line.product.id)"
                  >
                    × Xóa
                  </button>
                </div>
              </div>
              <QuantityStepper
                variant="pill"
                :model-value="line.quantity"
                :min="1"
                :max="line.product.stock"
                @update:model-value="cart.setQuantity(line.product.id, $event)"
              />
              <span class="elegant-cart-row__unit">{{ formatVnd(line.product.price) }}</span>
              <strong class="elegant-cart-row__subtotal">{{ formatVnd(line.subtotal) }}</strong>
            </div>
          </div>

          <section class="elegant-coupon">
            <h2>Bạn có mã giảm giá?</h2>
            <p>Nhập mã để được giảm ngay trên giỏ hàng (thử: SEDSP30)</p>
            <div class="elegant-coupon__form">
              <input v-model="coupon" type="text" placeholder="Mã giảm giá" />
              <button type="button" class="btn-elegant-primary btn-interactive" @click="applyCoupon">
                Áp dụng
              </button>
            </div>
            <p v-if="couponApplied" class="elegant-alert elegant-alert--success">Đã áp dụng mã giảm giá!</p>
          </section>
        </div>

        <aside class="elegant-summary">
          <h2 class="elegant-summary__title">Tóm tắt giỏ hàng</h2>

          <label class="elegant-shipping-opt" :class="{ 'elegant-shipping-opt--active': shipping === 'free' }">
            <input v-model="shipping" type="radio" value="free" name="shipping" />
            <span class="elegant-shipping-opt__label">Giao tiêu chuẩn</span>
            <span class="elegant-shipping-opt__price">
              {{ shipping === 'free' ? (shippingFee === 0 ? 'Miễn phí' : formatVnd(shippingFee)) : '' }}
            </span>
          </label>
          <label class="elegant-shipping-opt" :class="{ 'elegant-shipping-opt--active': shipping === 'express' }">
            <input v-model="shipping" type="radio" value="express" name="shipping" />
            <span class="elegant-shipping-opt__label">Giao nhanh</span>
            <span class="elegant-shipping-opt__price">+{{ formatVnd(35_000) }}</span>
          </label>
          <label class="elegant-shipping-opt" :class="{ 'elegant-shipping-opt--active': shipping === 'pickup' }">
            <input v-model="shipping" type="radio" value="pickup" name="shipping" />
            <span class="elegant-shipping-opt__label">Nhận tại cửa hàng</span>
            <span class="elegant-shipping-opt__price">Miễn phí</span>
          </label>

          <div class="elegant-summary__rows">
            <div class="elegant-summary__row">
              <span>Tạm tính</span>
              <span>{{ formatVnd(cart.total) }}</span>
            </div>
            <div v-if="discount" class="elegant-summary__row elegant-summary__row--discount">
              <span>Giảm giá</span>
              <span>-{{ formatVnd(discount) }}</span>
            </div>
            <div class="elegant-summary__row">
              <span>Phí vận chuyển</span>
              <span>{{ shippingFee === 0 ? 'Miễn phí' : formatVnd(shippingFee) }}</span>
            </div>
          </div>

          <div class="elegant-summary__total">
            <span>Tổng</span>
            <strong>{{ formatVnd(grandTotal) }}</strong>
          </div>

          <button type="button" class="btn-elegant-primary btn-block btn-interactive" @click="checkout">
            Thanh toán
          </button>
        </aside>
      </div>
    </div>

    <NewsletterBanner />
  </div>
</template>
