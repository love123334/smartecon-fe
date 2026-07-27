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
import type { PriceChartPoint } from '@/utils/dssPriceMock'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const props = defineProps<{ data: PriceChartPoint[] }>()

const chartData = computed(() => ({
  labels: props.data.map((d) => d.label),
  datasets: [
    {
      label: 'Giá bán TB',
      data: props.data.map((d) => d.averagePrice),
      borderColor: '#1976d2',
      backgroundColor: 'rgba(25, 118, 210, 0.1)',
      yAxisID: 'yPrice',
      tension: 0.3,
      borderWidth: 2.5,
      pointRadius: 3,
    },
    {
      label: 'Số lượng bán',
      data: props.data.map((d) => d.quantitySold),
      borderColor: '#2e7d32',
      backgroundColor: 'rgba(46, 125, 50, 0.1)',
      yAxisID: 'yQty',
      tension: 0.3,
      borderWidth: 2.5,
      pointRadius: 3,
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
    yPrice: {
      type: 'linear' as const,
      position: 'left' as const,
      title: { display: true, text: 'Giá bán TB' },
      grid: { color: 'rgba(0,0,0,0.06)' },
    },
    yQty: {
      type: 'linear' as const,
      position: 'right' as const,
      title: { display: true, text: 'Số lượng bán' },
      grid: { drawOnChartArea: false },
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
  height: 340px;
  width: 100%;
}
</style>
