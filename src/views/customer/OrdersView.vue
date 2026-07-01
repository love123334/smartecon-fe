<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { formatVnd, orderApi } from '@/api/services'
import type { Order } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { orderStatusLabel } from '@/utils/orderStatus'

const auth = useAuthStore()
const orders = ref<Order[]>([])

onMounted(async () => {
  if (auth.user) {
    orders.value = await orderApi.listForCustomer(auth.user.id)
  }
})

function statusClass(s: string) {
  return `badge badge-${s}`
}
</script>

<template>
  <div>
    <h1 class="page-title">Đơn hàng của tôi</h1>
    <p v-if="!orders.length" class="empty">Chưa có đơn hàng</p>
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
            <td>{{ o.id }}</td>
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
