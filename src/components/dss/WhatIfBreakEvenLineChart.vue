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
import type { BreakEvenCurvePoint } from '@/utils/dssSellerWhatIfMock'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const props = defineProps<{
  series: BreakEvenCurvePoint[]
}>()

const chartData = computed(() => ({
  labels: props.series.map((s) => `${s.discountPct}%`),
  datasets: [
    {
      label: 'Số lượng hòa vốn',
      data: props.series.map((s) => s.breakEvenQty),
      borderColor: '#1976d2',
      backgroundColor: 'rgba(25, 118, 210, 0.12)',
      borderWidth: 2.5,
      pointRadius: 4,
      tension: 0.35,
      fill: true,
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
      title: { display: true, text: 'Mức giảm giá (%)' },
      grid: { color: 'rgba(0,0,0,0.04)' },
    },
    y: {
      beginAtZero: true,
      title: { display: true, text: 'Số lượng hòa vốn' },
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
  height: 280px;
  width: 100%;
}
</style>
