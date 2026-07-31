<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { dssApi, orderApi, formatVnd } from '@/api/services'
import { monthlyRevenueChart, totalRevenue } from '@/utils/orderAnalytics'
import type { ChartPoint, Order } from '@/types'
import PageHeader from '@/components/PageHeader.vue'
import LineChart from '@/components/LineChart.vue'
import { orderStatusLabel } from '@/utils/orderStatus'

const sales = ref<ChartPoint[]>([])
const orders = ref<Order[]>([])
const loading = ref(true)

const totalRev = computed(() => totalRevenue(orders.value))
const recentOrders = computed(() => orders.value.slice(0, 8))

onMounted(async () => {
  loading.value = true
  try {
    orders.value = await orderApi.listAll()
    sales.value = await dssApi.salesChart()
    if (!sales.value.length && orders.value.length) {
      sales.value = monthlyRevenueChart(orders.value)
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <PageHeader
      class="page-header--animate"
      eyebrow="Quản lý"
      title="Bảng điều khiển"
      lead="KPI vận hành — dùng Đơn hàng để xác nhận/đẩy giao, và Duyệt role để xét hồ sơ Seller/Manager."
    />

    <p style="margin: 0 0 1rem; display: flex; flex-wrap: wrap; gap: 0.5rem">
      <RouterLink to="/manager/orders" class="btn btn-primary btn-sm">Quản lý đơn hàng</RouterLink>
      <RouterLink to="/manager/approvals" class="btn btn-outline btn-sm">Duyệt nâng quyền</RouterLink>
    </p>

    <div class="stat-grid grid-stagger">
      <div class="card stat-card stat-card--hover">
        <span class="stat-label">Tổng đơn hàng</span>
        <span class="stat-value">{{ orders.length }}</span>
      </div>
      <div class="card stat-card stat-card--hover">
        <span class="stat-label">Doanh thu</span>
        <span class="stat-value">{{ formatVnd(totalRev) }}</span>
      </div>
      <div class="card stat-card stat-card--hover">
        <span class="stat-label">Đơn trung bình</span>
        <span class="stat-value">
          {{ orders.length ? formatVnd(totalRev / orders.length) : '—' }}
        </span>
      </div>
    </div>

    <div class="card chart-card card--flat">
      <h2 class="card-title">Xu hướng doanh thu</h2>
      <LineChart v-if="sales.length" :data="sales" label="Doanh thu" />
      <p v-else-if="!loading" class="muted">Chưa có dữ liệu biểu đồ.</p>
      <p v-else class="muted">Đang tải…</p>
    </div>

    <div v-if="recentOrders.length" class="card card--flat" style="margin-top: 1.25rem">
      <h2 class="card-title">Đơn hàng gần đây</h2>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Khách</th>
              <th>Tổng</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in recentOrders" :key="o.id">
              <td>{{ o.id }}</td>
              <td>{{ o.customerName ?? '—' }}</td>
              <td>{{ formatVnd(o.total) }}</td>
              <td>{{ orderStatusLabel(o.status) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
