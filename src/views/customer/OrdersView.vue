<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { formatVnd, orderApi } from '@/api/services'
import type { Order } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { orderStatusLabel } from '@/utils/orderStatus'
import EmptyState from '@/components/EmptyState.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import OrderTrackStepper from '@/components/OrderTrackStepper.vue'
import PageHeader from '@/components/PageHeader.vue'

const auth = useAuthStore()
const orders = ref<Order[]>([])
const loading = ref(true)
const error = ref('')
const expandedId = ref<string | null>(null)

onMounted(async () => {
  if (!auth.user) {
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    orders.value = await orderApi.listForCustomer(auth.user.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được lịch sử mua hàng'
    orders.value = []
  } finally {
    loading.value = false
  }
})

function statusClass(s: string) {
  return `badge badge-${s}`
}

function toggleTrack(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Khách hàng"
      title="Lịch sử mua hàng"
      lead="Theo dõi trạng thái từng đơn — từ chờ xác nhận đến đã giao. Đánh giá sản phẩm trong 30 ngày sau khi nhận hàng."
    />

    <LoadingSpinner v-if="loading" />
    <p v-else-if="error" class="form-error">{{ error }}</p>
    <EmptyState
      v-else-if="!orders.length"
      icon="📦"
      title="Chưa có đơn hàng"
      description="Giỏ hàng trống hoặc bạn chưa checkout. Thêm sản phẩm rồi thanh toán để thấy lịch sử tại đây."
    >
      <RouterLink to="/search" class="btn btn-primary" style="margin-top: 1rem; display: inline-flex">
        Mua sắm ngay
      </RouterLink>
    </EmptyState>
    <div v-else class="orders-track-list">
      <article v-for="o in orders" :key="o.id" class="card orders-track-card">
        <div class="orders-track-card__row">
          <div>
            <strong>#{{ o.id }}</strong>
            <p class="muted">
              {{ new Date(o.createdAt).toLocaleString('vi-VN') }}
              · {{ o.items.length }} sản phẩm
            </p>
          </div>
          <div class="orders-track-card__meta">
            <span>{{ formatVnd(o.total) }}</span>
            <span :class="statusClass(o.status)">{{ orderStatusLabel(o.status) }}</span>
          </div>
        </div>

        <OrderTrackStepper :status="o.status" compact show-hint />

        <div class="orders-track-card__actions">
          <button type="button" class="btn btn-sm" @click="toggleTrack(o.id)">
            {{ expandedId === o.id ? 'Ẩn sản phẩm' : 'Xem sản phẩm' }}
          </button>
          <RouterLink :to="`/orders/${o.id}`" class="btn btn-primary btn-sm">
            Chi tiết & theo dõi
          </RouterLink>
        </div>

        <ul v-if="expandedId === o.id" class="orders-track-card__items">
          <li v-for="item in o.items" :key="item.productId">
            {{ item.productName }} × {{ item.quantity }}
            <RouterLink
              v-if="o.status === 'delivered'"
              :to="`/products/${item.productId}#reviews`"
              class="review-inline"
            >
              Đánh giá
            </RouterLink>
          </li>
        </ul>
      </article>
    </div>
  </div>
</template>

<style scoped>
.orders-track-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.orders-track-card {
  padding: 1rem 1.15rem;
}

.orders-track-card__row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: flex-start;
}

.orders-track-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  font-weight: 600;
}

.orders-track-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.orders-track-card__items {
  margin: 0.75rem 0 0;
  padding-left: 1.1rem;
  font-size: 0.875rem;
}

.review-inline {
  margin-left: 0.5rem;
  font-size: 0.8125rem;
}

.muted {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: var(--slate-500, #64748b);
  font-weight: 400;
}
</style>
