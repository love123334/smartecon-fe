<script setup lang="ts">
import { computed } from 'vue'
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Radar } from 'vue-chartjs'
import type { RadarScores } from '@/utils/dssManagerWhatIfMock'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

const props = defineProps<{ radar: RadarScores[] }>()

const colors = [
  { border: '#1976d2', fill: 'rgba(25, 118, 210, 0.18)' },
  { border: '#2e7d32', fill: 'rgba(46, 125, 50, 0.16)' },
  { border: '#f57c00', fill: 'rgba(245, 124, 0, 0.14)' },
  { border: '#c62828', fill: 'rgba(198, 40, 40, 0.12)' },
]

const chartData = computed(() => ({
  labels: ['Tăng nhu cầu', 'Lợi nhuận', 'An toàn tồn kho'],
  datasets: props.radar.map((r, i) => ({
    label: `${r.discountPct}%`,
    data: [r.demandGrowth, r.profit, r.inventorySafety],
    borderColor: colors[i % colors.length].border,
    backgroundColor: colors[i % colors.length].fill,
    borderWidth: 2,
    pointRadius: 3,
  })),
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const },
  },
  scales: {
    r: {
      beginAtZero: true,
      max: 100,
      ticks: { stepSize: 20 },
      grid: { color: 'rgba(0,0,0,0.08)' },
    },
  },
}
</script>

<template>
  <div class="chart-wrap">
    <Radar :data="chartData" :options="options" />
  </div>
</template>

<style scoped>
.chart-wrap {
  height: 300px;
  width: 100%;
}
</style>
