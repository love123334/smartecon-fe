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
  Filler,
} from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

export interface SalesHistoryPoint {
  day: number
  qty: number
  date?: string
}

const props = defineProps<{
  historical: SalesHistoryPoint[]
}>()

function formatLabel(pt: SalesHistoryPoint): string {
  if (pt.date) {
    const d = new Date(pt.date)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
    }
    return String(pt.date)
  }
  return `Ngày ${pt.day}`
}

const chartData = computed(() => ({
  labels: props.historical.map(formatLabel),
  datasets: [
    {
      label: 'Doanh số lịch sử',
      data: props.historical.map((h) => h.qty),
      borderColor: '#1976d2',
      backgroundColor: 'rgba(25, 118, 210, 0.12)',
      borderWidth: 2.5,
      pointRadius: 3,
      tension: 0.25,
      fill: true,
    },
  ],
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: { position: 'bottom' as const },
  },
  scales: {
    x: {
      title: { display: true, text: 'Thời gian' },
      grid: { color: 'rgba(0,0,0,0.04)' },
    },
    y: {
      title: { display: true, text: 'Số lượng bán' },
      beginAtZero: true,
      grid: { color: 'rgba(0,0,0,0.06)' },
    },
  },
}
</script>

<template>
  <div class="chart-wrap">
    <Line :data="chartData" :options="options" />
  </div>
</template>

<style scoped>
.chart-wrap {
  height: 320px;
  width: 100%;
}
</style>
