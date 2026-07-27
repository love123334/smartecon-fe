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

const props = defineProps<{
  historical: { day: number; qty: number }[]
  forecast: { day: number; qty: number }[]
}>()

const chartData = computed(() => {
  const histDays = props.historical.map((h) => h.day)
  const forecastDays = props.forecast.map((f) => f.day)
  const labels = [...new Set([...histDays, ...forecastDays])].sort((a, b) => a - b)

  const histMap = new Map(props.historical.map((h) => [h.day, h.qty]))
  const fcMap = new Map(props.forecast.map((f) => [f.day, f.qty]))

  return {
    labels: labels.map((d) => `Ngày ${d}`),
    datasets: [
      {
        label: 'Doanh số lịch sử',
        data: labels.map((d) => histMap.get(d) ?? null),
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25, 118, 210, 0.12)',
        borderWidth: 2.5,
        pointRadius: 3,
        tension: 0.25,
        fill: false,
        spanGaps: false,
      },
      {
        label: 'Dự báo',
        data: labels.map((d) => fcMap.get(d) ?? null),
        borderColor: '#f57c00',
        backgroundColor: 'transparent',
        borderWidth: 2.5,
        borderDash: [8, 6],
        pointRadius: 3,
        tension: 0.2,
        fill: false,
        spanGaps: true,
      },
    ],
  }
})

const options = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: { position: 'bottom' as const },
  },
  scales: {
    x: {
      title: { display: true, text: 'Ngày lịch sử' },
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
