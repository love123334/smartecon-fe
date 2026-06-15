<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { formatVnd } from '@/api/services'
import { useCartStore } from '@/stores/cart'
import QuantityStepper from '@/components/QuantityStepper.vue'

const cart = useCartStore()
const { drawerOpen, lines, loading } = storeToRefs(cart)
const router = useRouter()

const subtotal = computed(() => cart.total)
const total = computed(() => cart.total)

function close() {
  cart.closeDrawer()
}

function goCart() {
  close()
  router.push('/cart')
}

function goCheckout() {
  close()
  router.push('/checkout')
}

watch(drawerOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="drawerOpen" class="cart-flyout-root" role="presentation">
      <div
        class="cart-flyout-backdrop"
        aria-hidden="true"
        @click="close"
      />

      <aside
        class="cart-flyout"
        role="dialog"
        aria-label="Giỏ hàng"
        aria-modal="true"
      >
        <header class="cart-flyout__header">
          <h2 class="cart-flyout__title">Giỏ hàng</h2>
          <button type="button" class="cart-flyout__close" aria-label="Đóng" @click="close">
            ×
          </button>
        </header>

        <div v-if="loading" class="cart-flyout__empty">Đang tải...</div>
        <div v-else-if="!lines.length" class="cart-flyout__empty">
          <p>Giỏ hàng trống</p>
          <button type="button" class="btn-elegant-outline" @click="close(); router.push('/')">
            Mua sắm ngay
          </button>
        </div>

        <template v-else>
          <ul class="cart-flyout__list">
            <li v-for="line in lines" :key="line.product.id" class="cart-flyout__item">
              <img :src="line.product.imageUrl" :alt="line.product.name" class="cart-flyout__thumb" />
              <div class="cart-flyout__info">
                <div class="cart-flyout__name">{{ line.product.name }}</div>
                <div class="cart-flyout__meta">{{ line.product.category }}</div>
                <QuantityStepper
                  variant="pill"
                  :model-value="line.quantity"
                  :min="1"
                  :max="line.product.stock"
                  @update:model-value="cart.setQuantity(line.product.id, $event)"
                />
              </div>
              <div class="cart-flyout__right">
                <span class="cart-flyout__price">{{ formatVnd(line.subtotal) }}</span>
                <button
                  type="button"
                  class="cart-flyout__remove"
                  aria-label="Xóa"
                  @click="cart.remove(line.product.id)"
                >
                  ×
                </button>
              </div>
            </li>
          </ul>

          <footer class="cart-flyout__footer">
            <div class="cart-flyout__row">
              <span>Tạm tính</span>
              <span>{{ formatVnd(subtotal) }}</span>
            </div>
            <div class="cart-flyout__row cart-flyout__row--total">
              <span>Tổng</span>
              <strong>{{ formatVnd(total) }}</strong>
            </div>
            <button type="button" class="btn-elegant-primary btn-block btn-interactive" @click="goCheckout">
              Thanh toán
            </button>
            <button type="button" class="cart-flyout__view-cart btn-interactive" @click="goCart">
              Xem giỏ hàng
            </button>
          </footer>
        </template>
      </aside>
    </div>
  </Teleport>
</template>
