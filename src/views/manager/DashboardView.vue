<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { dssApi, orderApi, formatVnd } from '@/api/services'
import type { ChartPoint, Order } from '@/types'
import PageHeader from '@/components/PageHeader.vue'
import LineChart from '@/components/LineChart.vue'

const sales = ref<ChartPoint[]>([])
const orders = ref<Order[]>([])
const totalRevenue = ref(0)

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
      eyebrow="Manager"
      title="Bảng điều khiển"
      lead="Tổng quan KPI — doanh thu và đơn hàng theo thời gian thực (demo)."
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
  </div>
</template>
