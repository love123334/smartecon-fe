<script setup lang="ts">
import { computed } from 'vue'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const props = defineProps<{
  historical: { date: string; qty: number }[]
  forecast: { date: string; qty: number }[]
}>()

function shortDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(date)
}

const chartData = computed(() => {
  const labels = [...props.historical, ...props.forecast].map((point) => shortDate(point.date))
  const historyLength = props.historical.length
  const historicalData = [
    ...props.historical.map((point) => point.qty),
    ...props.forecast.map(() => null),
  ]
  const forecastData: Array<number | null> = Array(Math.max(0, historyLength - 1)).fill(null)
  if (historyLength) forecastData.push(props.historical[historyLength - 1]?.qty ?? null)
  forecastData.push(...props.forecast.map((point) => point.qty))

  return {
    labels,
    datasets: [
      {
        label: 'Nhu cầu thực tế',
        data: historicalData,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.12)',
        borderWidth: 2.5,
        pointRadius: historyLength > 60 ? 0 : 2,
        tension: 0.22,
        fill: true,
      },
      {
        label: 'Đường dự báo',
        data: forecastData,
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.10)',
        borderWidth: 2.5,
        borderDash: [7, 5],
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
  plugins: { legend: { position: 'bottom' as const } },
  scales: {
    x: { grid: { display: false }, ticks: { maxTicksLimit: 14 } },
    y: { beginAtZero: true, title: { display: true, text: 'Số lượng bán' } },
  },
}
</script>

<template>
  <div class="forecast-chart"><Line :data="chartData" :options="options" /></div>
</template>

<style scoped>
.forecast-chart { width: 100%; height: 360px; }
</style>
