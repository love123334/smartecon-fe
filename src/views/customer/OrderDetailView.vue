<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { formatVnd, orderApi, productApi } from '@/api/services'
import type { Order, OrderStatus } from '@/types'
import CheckoutStepper from '@/components/CheckoutStepper.vue'
import NewsletterBanner from '@/components/NewsletterBanner.vue'

const route = useRoute()
const order = ref<Order | null>(null)
const productImages = ref<Record<string, string>>({})

const paymentLabel = computed(() => {
  return 'Thanh toán khi nhận hàng'
})

const statusSteps: { key: OrderStatus; label: string }[] = [
  { key: 'pending', label: 'Chờ xác nhận' },
  { key: 'confirmed', label: 'Đã xác nhận' },
  { key: 'shipping', label: 'Đang giao' },
  { key: 'delivered', label: 'Đã giao' },
]

const statusIndex = computed(() => {
  if (!order.value || order.value.status === 'cancelled') return -1
  return statusSteps.findIndex((s) => s.key === order.value!.status)
})

const statusLabel: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao hàng',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
}

const isFreshOrder = computed(() => {
  if (!order.value) return false
  const age = Date.now() - new Date(order.value.createdAt).getTime()
  return age < 1000 * 60 * 30
})

onMounted(async () => {
  order.value = await orderApi.getById(route.params.id as string)
  if (order.value) {
    const products = await productApi.list()
    const map: Record<string, string> = {}
    for (const p of products) {
      map[p.id] = p.imageUrl
    }
    productImages.value = map
  }
})

function stepClass(i: number) {
  if (statusIndex.value < 0) return ''
  if (i < statusIndex.value) return 'mkt-status-step--done'
  if (i === statusIndex.value) return 'mkt-status-step--active'
  return ''
}
</script>

<template>
  <div v-if="order" class="elegant-page">
    <div class="container elegant-page__inner">
      <template v-if="isFreshOrder && order.status !== 'cancelled'">
        <h1 class="elegant-page-title">Hoàn tất!</h1>
        <CheckoutStepper :step="3" />

        <div class="elegant-complete">
          <div class="elegant-complete__card">
            <p class="elegant-complete__emoji">Cảm ơn bạn! 🎉</p>
            <h2 class="elegant-complete__heading">Đơn hàng đã được tiếp nhận</h2>

            <div class="elegant-complete__thumbs">
              <div
                v-for="item in order.items"
                :key="item.productId"
                class="elegant-complete__thumb"
              >
                <img
                  :src="productImages[item.productId] ?? 'https://placehold.co/80x80/f3f5f7/737373?text=SP'"
                  :alt="item.productName"
                />
                <span class="elegant-complete__qty">{{ item.quantity }}</span>
              </div>
            </div>

            <dl class="elegant-complete__meta">
              <div>
                <dt>Mã đơn</dt>
                <dd>#{{ order.id }}</dd>
              </div>
              <div>
                <dt>Ngày đặt</dt>
                <dd>{{ new Date(order.createdAt).toLocaleDateString('vi-VN') }}</dd>
              </div>
              <div>
                <dt>Tổng tiền</dt>
                <dd>{{ formatVnd(order.total) }}</dd>
              </div>
              <div>
                <dt>Thanh toán</dt>
                <dd>{{ paymentLabel }}</dd>
              </div>
            </dl>

            <RouterLink to="/orders" class="btn-elegant-primary btn-block btn-interactive">
              Lịch sử mua hàng
            </RouterLink>
          </div>
        </div>
      </template>

      <template v-else>
        <nav class="elegant-crumb">
          <RouterLink to="/">Trang chủ</RouterLink>
          <span class="elegant-crumb__sep">›</span>
          <RouterLink to="/orders">Đơn hàng</RouterLink>
          <span class="elegant-crumb__sep">›</span>
          <span>{{ order.id }}</span>
        </nav>

        <div class="elegant-order-detail">
          <div class="elegant-order-detail__head">
            <div>
              <h1 class="elegant-page-title" style="margin-bottom: 0.35rem">Đơn hàng #{{ order.id }}</h1>
              <p class="elegant-muted">
                Đặt ngày {{ new Date(order.createdAt).toLocaleString('vi-VN') }}
              </p>
            </div>
            <span class="elegant-status-badge" :data-status="order.status">
              {{ statusLabel[order.status] }}
            </span>
          </div>

          <div v-if="order.status !== 'cancelled'" class="mkt-status-stepper">
            <div
              v-for="(step, i) in statusSteps"
              :key="step.key"
              class="mkt-status-step"
              :class="stepClass(i)"
            >
              <span class="mkt-status-step__dot">{{ i + 1 }}</span>
              <span>{{ step.label }}</span>
            </div>
          </div>

          <p><strong>Địa chỉ giao:</strong> {{ order.shippingAddress }}</p>

          <div class="elegant-cart-table elegant-cart-table--order">
            <div class="elegant-cart-table__head">
              <span>Sản phẩm</span>
              <span>Số lượng</span>
              <span>Đơn giá</span>
              <span>Thành tiền</span>
            </div>
            <div v-for="item in order.items" :key="item.productId" class="elegant-cart-row">
              <div class="elegant-cart-row__product">
                <img
                  :src="productImages[item.productId] ?? 'https://placehold.co/80x80/f3f5f7/737373?text=SP'"
                  :alt="item.productName"
                />
                <div>
                  <div class="elegant-cart-row__name">{{ item.productName }}</div>
                </div>
              </div>
              <span>{{ item.quantity }}</span>
              <span class="elegant-cart-row__unit">{{ formatVnd(item.unitPrice) }}</span>
              <strong class="elegant-cart-row__subtotal">
                {{ formatVnd(item.unitPrice * item.quantity) }}
              </strong>
            </div>
          </div>

          <div class="elegant-summary__total" style="justify-content: flex-end; margin-top: 1.5rem">
            <span>Tổng</span>
            <strong>{{ formatVnd(order.total) }}</strong>
          </div>

          <RouterLink to="/orders" class="btn-elegant-outline btn-interactive" style="margin-top: 1.5rem; display: inline-flex">
            ← Quay lại đơn hàng
          </RouterLink>
        </div>
      </template>
    </div>

    <NewsletterBanner />
  </div>
  <p v-else class="empty container">Không tìm thấy đơn hàng</p>
</template>
