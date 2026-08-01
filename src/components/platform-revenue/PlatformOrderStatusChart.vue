<script setup lang="ts">
import { computed } from 'vue'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut } from 'vue-chartjs'
import type { OrderStatusDistributionItem } from '@/api/real/platformRevenue'
import {
  formatPlatformNumber,
  formatPlatformPercent,
  orderStatusDisplayLabel,
} from '@/utils/platformRevenue'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps<{
  items: OrderStatusDistributionItem[]
}>()

const COLORS = ['#0d9488', '#2563eb', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b', '#14b8a6']

const hasData = computed(() => props.items.some((i) => Number(i.orderCount) > 0))

const chartData = computed(() => ({
  labels: props.items.map((i) => orderStatusDisplayLabel(i.status)),
  datasets: [
    {
      data: props.items.map((i) => Number(i.orderCount) || 0),
      backgroundColor: props.items.map((_, idx) => COLORS[idx % COLORS.length]),
      borderWidth: 1,
      borderColor: '#fff',
    },
  ],
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const },
  },
}
</script>

<template>
  <section class="card" aria-labelledby="pr-order-status-title">
    <h2 id="pr-order-status-title" class="pr-section-title">Order Status Distribution</h2>
    <div v-if="hasData" class="pr-split">
      <div class="chart-box">
        <Doughnut :data="chartData" :options="options" />
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Status</th>
              <th>Orders</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in items" :key="row.status">
              <td>{{ orderStatusDisplayLabel(row.status) }}</td>
              <td>{{ formatPlatformNumber(row.orderCount) }}</td>
              <td>{{ formatPlatformPercent(row.percentage) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <p v-else class="muted">Chưa có phân bố trạng thái đơn hàng.</p>
  </section>
</template>

<style scoped>
.pr-section-title {
  margin: 0 0 0.85rem;
  font-size: 1rem;
}
.pr-split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: 1rem;
  align-items: center;
}
.chart-box {
  height: 240px;
  position: relative;
}
@media (max-width: 800px) {
  .pr-split {
    grid-template-columns: 1fr;
  }
}
</style>
