<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { formatVnd, orderApi } from '@/api/services'
import type { Order } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { orderStatusLabel } from '@/utils/orderStatus'
import EmptyState from '@/components/EmptyState.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'

const auth = useAuthStore()
const orders = ref<Order[]>([])
const loading = ref(true)
const error = ref('')

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
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Khách hàng"
      title="Lịch sử mua hàng"
      lead="Theo dõi đơn đã đặt — dữ liệu từ tài khoản của bạn trên hệ thống."
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
    <div v-else class="table-wrap card">
      <table class="data">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Ngày</th>
            <th>Tổng</th>
            <th>Trạng thái</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in orders" :key="o.id">
            <td>#{{ o.id }}</td>
            <td>{{ new Date(o.createdAt).toLocaleDateString('vi-VN') }}</td>
            <td>{{ formatVnd(o.total) }}</td>
            <td><span :class="statusClass(o.status)">{{ orderStatusLabel(o.status) }}</span></td>
            <td>
              <RouterLink :to="`/orders/${o.id}`">Chi tiết</RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
