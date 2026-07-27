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
import type { PromoScenarioRow } from '@/utils/dssManagerWhatIfMock'
import { formatUsd } from '@/utils/dssManagerWhatIfMock'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const props = defineProps<{ rows: PromoScenarioRow[] }>()

const chartData = computed(() => ({
  labels: props.rows.map((r) => `${r.discountPct}%`),
  datasets: [
    {
      label: 'Lợi nhuận',
      data: props.rows.map((r) => r.profit),
      borderColor: '#2e7d32',
      backgroundColor: 'rgba(46, 125, 50, 0.12)',
      borderWidth: 2.5,
      pointRadius: 4,
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
    tooltip: {
      callbacks: {
        label: (ctx: { parsed: { y: number | null } }) => formatUsd(ctx.parsed.y ?? 0),
      },
    },
  },
  scales: {
    x: {
      title: { display: true, text: 'Mức giảm giá' },
      grid: { color: 'rgba(0,0,0,0.04)' },
    },
    y: {
      beginAtZero: true,
      title: { display: true, text: 'Lợi nhuận (USD)' },
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
  height: 260px;
  width: 100%;
}
</style>
