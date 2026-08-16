<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { dssApi, orderApi, formatVnd } from '@/api/services'
import { dedupeOrdersById, monthlyRevenueChart, salesEligibleOrders, totalRevenue } from '@/utils/orderAnalytics'
import type { ChartPoint, Order } from '@/types'
import PageHeader from '@/components/PageHeader.vue'
import LineChart from '@/components/LineChart.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import { orderStatusLabel } from '@/utils/orderStatus'

const sales = ref<ChartPoint[]>([])
const orders = ref<Order[]>([])
const loading = ref(true)

const totalRev = computed(() => totalRevenue(orders.value))
const salesOrderCount = computed(() => salesEligibleOrders(orders.value).length)
const recentOrders = computed(() => dedupeOrdersById(orders.value).slice(0, 8))

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
      lead="Theo dõi KPI vận hành, phân tích danh mục và các module DSS hỗ trợ quyết định."
    />

    <p style="margin: 0 0 1rem; display: flex; flex-wrap: wrap; gap: 0.5rem">
      <RouterLink to="/manager/platform-revenue" class="btn btn-primary btn-sm">Doanh thu sàn</RouterLink>
      <RouterLink to="/manager/analytics" class="btn btn-outline btn-sm">Phân tích</RouterLink>
      <RouterLink to="/manager/dss" class="btn btn-outline btn-sm">DSS quản lý</RouterLink>
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
          {{ salesOrderCount ? formatVnd(totalRev / salesOrderCount) : '—' }}
        </span>
      </div>
    </div>

    <div class="card chart-card card--flat">
      <h2 class="card-title">Xu hướng doanh thu</h2>
      <LineChart v-if="sales.length" :data="sales" label="Doanh thu" />
      <p v-else-if="!loading" class="muted">Chưa có dữ liệu biểu đồ.</p>
      <LoadingSpinner v-else size="sm" label="Đang tải" />
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
