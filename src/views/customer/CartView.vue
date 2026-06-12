<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { formatVnd } from '@/api/services'
import { useCartStore } from '@/stores/cart'
import QuantityStepper from '@/components/QuantityStepper.vue'
import EmptyState from '@/components/EmptyState.vue'

const cart = useCartStore()
const router = useRouter()

const shippingFee = computed(() => (cart.total >= 500_000 ? 0 : 30_000))
const grandTotal = computed(() => cart.total + shippingFee.value)

onMounted(() => cart.refresh())

function checkout() {
  router.push('/checkout')
}
</script>

<template>
  <div>
    <nav class="mkt-breadcrumb">
      <RouterLink to="/">Trang chủ</RouterLink>
      <span>/</span>
      <span>Giỏ hàng</span>
    </nav>

    <h1 class="page-title" style="font-size: 1.25rem; margin-bottom: 1rem">Giỏ hàng ({{ cart.itemCount }})</h1>

    <p v-if="cart.loading" class="empty">Đang tải...</p>
    <EmptyState
      v-else-if="!cart.lines.length"
      icon="🛒"
      title="Giỏ hàng trống"
      description="Khám phá sản phẩm và thêm vào giỏ nhé!"
    >
      <RouterLink to="/" class="btn btn-primary" style="margin-top: 1rem">Mua sắm ngay</RouterLink>
    </EmptyState>

    <div v-else class="mkt-cart-layout">
      <div class="mkt-cart-table">
        <div
          v-for="line in cart.lines"
          :key="line.product.id"
          class="mkt-cart-row"
        >
          <img
            :src="line.product.imageUrl"
            :alt="line.product.name"
            class="mkt-cart-row__img"
          />
          <div>
            <div class="mkt-cart-row__name">{{ line.product.name }}</div>
            <div class="mkt-cart-row__variant">{{ line.product.category }}</div>
            <p class="price" style="margin: 0.35rem 0 0; font-size: 0.9375rem; color: var(--primary-700)">
              {{ formatVnd(line.product.price) }}
            </p>
          </div>
          <QuantityStepper
            :model-value="line.quantity"
            :min="1"
            :max="line.product.stock"
            @update:model-value="cart.setQuantity(line.product.id, $event)"
          />
          <strong style="color: var(--primary-700); min-width: 90px; text-align: right">
            {{ formatVnd(line.subtotal) }}
          </strong>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            aria-label="Xóa"
            @click="cart.remove(line.product.id)"
          >
            ✕
          </button>
        </div>
      </div>

      <aside class="mkt-cart-summary">
        <div class="mkt-voucher">🏷️ Chọn hoặc nhập mã giảm giá</div>
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
          <span>Tổng thanh toán</span>
          <span class="mkt-cart-summary__total">{{ formatVnd(grandTotal) }}</span>
        </div>
        <button type="button" class="btn btn-primary btn-block" style="margin-top: 1rem" @click="checkout">
          Mua hàng
        </button>
      </aside>
    </div>
  </div>
</template>
