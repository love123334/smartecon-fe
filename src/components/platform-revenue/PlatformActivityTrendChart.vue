<script setup lang="ts">
import { computed } from 'vue'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import type { PlatformActivityTrendPoint, RevenueGranularity } from '@/api/real/platformRevenue'
import { formatPeriodLabel } from '@/utils/platformRevenue'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
)

const props = defineProps<{
  trend: PlatformActivityTrendPoint[]
  granularity: RevenueGranularity
}>()

const hasData = computed(() => props.trend.length > 0)

const chartData = computed(() => ({
  labels: props.trend.map((p) => formatPeriodLabel(p.periodStart, props.granularity)),
  datasets: [
    {
      label: 'New Sellers',
      data: props.trend.map((p) => Number(p.newSellers) || 0),
      borderColor: '#0d9488',
      backgroundColor: 'transparent',
      tension: 0.25,
    },
    {
      label: 'New Customers',
      data: props.trend.map((p) => Number(p.newCustomers) || 0),
      borderColor: '#2563eb',
      backgroundColor: 'transparent',
      tension: 0.25,
    },
    {
      label: 'New Products',
      data: props.trend.map((p) => Number(p.newProducts) || 0),
      borderColor: '#f59e0b',
      backgroundColor: 'transparent',
      tension: 0.25,
    },
  ],
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: true } },
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
}
</script>

<template>
  <section class="card pr-trend" aria-labelledby="pr-activity-trend-title">
    <h2 id="pr-activity-trend-title" class="pr-section-title">Activity Trend</h2>
    <div v-if="hasData" class="chart-box">
      <Line :data="chartData" :options="options" />
    </div>
    <p v-else class="muted">Chưa có xu hướng hoạt động trong khoảng đã chọn.</p>
  </section>
</template>

<style scoped>
.pr-trend {
  margin-bottom: 1.25rem;
}
.pr-section-title {
  margin: 0 0 0.85rem;
  font-size: 1rem;
}
.chart-box {
  height: 260px;
  position: relative;
}
</style>
