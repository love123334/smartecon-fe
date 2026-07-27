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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const props = defineProps<{
  series: { day: number; qty: number }[]
  productName?: string
}>()

const chartData = computed(() => ({
  labels: props.series.map((s) => `Ngày ${s.day}`),
  datasets: [
    {
      label: 'Số lượng bán',
      data: props.series.map((s) => s.qty),
      borderColor: '#1976d2',
      backgroundColor: 'rgba(25, 118, 210, 0.12)',
      borderWidth: 2.5,
      pointRadius: 3,
      tension: 0.3,
      fill: true,
    },
  ],
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const },
    title: {
      display: !!props.productName,
      text: props.productName ? `Xu hướng bán — ${props.productName}` : '',
    },
  },
  scales: {
    x: {
      title: { display: true, text: 'Ngày lịch sử' },
      grid: { color: 'rgba(0,0,0,0.04)' },
    },
    y: {
      beginAtZero: true,
      title: { display: true, text: 'Số lượng bán' },
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
  height: 300px;
  width: 100%;
}
</style>
