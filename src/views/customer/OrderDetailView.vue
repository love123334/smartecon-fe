<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { formatVnd, orderApi } from '@/api/services'
import type { Order, OrderStatus } from '@/types'

const route = useRoute()
const order = ref<Order | null>(null)

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

onMounted(async () => {
  order.value = await orderApi.getById(route.params.id as string)
})

function stepClass(i: number) {
  if (statusIndex.value < 0) return ''
  if (i < statusIndex.value) return 'mkt-status-step--done'
  if (i === statusIndex.value) return 'mkt-status-step--active'
  return ''
}
</script>

<template>
  <div v-if="order">
    <nav class="mkt-breadcrumb">
      <RouterLink to="/">Trang chủ</RouterLink>
      <span>/</span>
      <RouterLink to="/orders">Đơn hàng</RouterLink>
      <span>/</span>
      <span>{{ order.id }}</span>
    </nav>

    <div class="mkt-section">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem">
        <div>
          <h1 class="page-title" style="font-size: 1.25rem; margin: 0">Đơn hàng {{ order.id }}</h1>
          <p class="muted" style="margin: 0.35rem 0 0">
            Đặt ngày {{ new Date(order.createdAt).toLocaleString('vi-VN') }}
          </p>
        </div>
        <span class="badge" :class="`badge-${order.status}`">{{ statusLabel[order.status] }}</span>
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

      <div class="table-wrap" style="margin-top: 1rem">
        <table class="data">
          <thead>
            <tr>
              <th>Sản phẩm</th>
              <th>SL</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in order.items" :key="item.productId">
              <td>{{ item.productName }}</td>
              <td>{{ item.quantity }}</td>
              <td>{{ formatVnd(item.unitPrice) }}</td>
              <td>{{ formatVnd(item.unitPrice * item.quantity) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="mkt-cart-summary__total" style="text-align: right; margin-top: 1rem">
        Tổng: {{ formatVnd(order.total) }}
      </p>

      <RouterLink to="/orders" class="btn btn-outline" style="margin-top: 1rem">← Quay lại đơn hàng</RouterLink>
    </div>
  </div>
  <p v-else class="empty">Không tìm thấy đơn hàng</p>
</template>
