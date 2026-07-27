<script setup lang="ts">
import { computed } from 'vue'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'vue-chartjs'
import type { InventoryRow } from '@/utils/dssInventoryMock'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const props = defineProps<{ rows: InventoryRow[] }>()

const chartData = computed(() => ({
  labels: props.rows.map((r) => r.productName),
  datasets: [
    {
      label: 'Tồn kho hiện tại',
      data: props.rows.map((r) => r.currentStock),
      backgroundColor: '#1976d2',
      borderRadius: 6,
    },
    {
      label: 'Điểm đặt hàng lại (ROP)',
      data: props.rows.map((r) => r.reorderPoint),
      backgroundColor: '#f57c00',
      borderRadius: 6,
    },
    {
      label: 'Số lượng đề xuất nhập',
      data: props.rows.map((r) => r.recommendedOrder),
      backgroundColor: '#2e7d32',
      borderRadius: 6,
    },
  ],
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const },
  },
  scales: {
    x: {
      ticks: { maxRotation: 25, minRotation: 0 },
      grid: { display: false },
    },
    y: {
      beginAtZero: true,
      title: { display: true, text: 'Số lượng' },
      grid: { color: 'rgba(0,0,0,0.06)' },
    },
  },
}
</script>

<template>
  <div class="chart-wrap">
    <Bar :data="chartData" :options="options" />
  </div>
</template>

<style scoped>
.chart-wrap {
  height: 320px;
  width: 100%;
}
</style>
