<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { dssApi, orderApi, formatVnd } from '@/api/services'
import type { ChartPoint, Order } from '@/types'
import HybridDataNotice from '@/components/HybridDataNotice.vue'
import PageHeader from '@/components/PageHeader.vue'
import LineChart from '@/components/LineChart.vue'
import { orderStatusLabel } from '@/utils/orderStatus'

const sales = ref<ChartPoint[]>([])
const orders = ref<Order[]>([])
const totalRevenue = ref(0)

const recentOrders = computed(() => orders.value.slice(0, 8))

onMounted(async () => {
  sales.value = await dssApi.salesChart()
  orders.value = await orderApi.listAll()
  totalRevenue.value = orders.value.reduce((s, o) => s + o.total, 0)
})
</script>

<template>
  <div>
    <PageHeader
      class="page-header--animate"
      eyebrow="Quản lý"
      title="Bảng điều khiển"
      lead="Tổng quan KPI — đơn hàng demo + đơn thật từ backend."
    />
    <HybridDataNotice
      message="Đơn hàng gộp mock + API; biểu đồ doanh thu vẫn mô phỏng cho đến khi có module analytics."
    />

    <div class="stat-grid grid-stagger">
      <div class="card stat-card stat-card--hover">
        <span class="stat-label">Tổng đơn hàng</span>
        <span class="stat-value">{{ orders.length }}</span>
      </div>
      <div class="card stat-card stat-card--hover">
        <span class="stat-label">Doanh thu</span>
        <span class="stat-value">{{ formatVnd(totalRevenue) }}</span>
      </div>
      <div class="card stat-card stat-card--hover">
        <span class="stat-label">Đơn trung bình</span>
        <span class="stat-value">
          {{ orders.length ? formatVnd(totalRevenue / orders.length) : '—' }}
        </span>
      </div>
    </div>

    <div class="card chart-card card--flat">
      <h2 class="card-title">Xu hướng doanh thu</h2>
      <LineChart v-if="sales.length" :data="sales" label="Doanh thu" />
      <p v-else class="muted">Chưa có dữ liệu biểu đồ.</p>
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
