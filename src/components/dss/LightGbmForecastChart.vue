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
import { formatChartDayVi } from '@/utils/demandPrediction'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const props = defineProps<{
  historical: { date: string; qty: number }[]
  forecast: { date: string; qty: number }[]
}>()

function shortDate(value: string) {
  return formatChartDayVi(value) || value
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
    y: {
      beginAtZero: true,
      grace: '8%',
      title: { display: true, text: 'Số lượng bán' },
      ticks: { maxTicksLimit: 8 },
    },
  },
}
</script>

<template>
  <div class="forecast-chart"><Line :data="chartData" :options="options" /></div>
</template>

<style scoped>
.forecast-chart { width: 100%; height: 360px; }
</style>
