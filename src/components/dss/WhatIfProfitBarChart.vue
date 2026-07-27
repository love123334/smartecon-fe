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
import { formatUsd } from '@/utils/dssSellerWhatIfMock'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const props = defineProps<{
  currentProfit: number
  expectedProfit: number
}>()

const chartData = computed(() => ({
  labels: ['Lợi nhuận hiện tại', 'Lợi nhuận kỳ vọng'],
  datasets: [
    {
      label: 'Lợi nhuận',
      data: [props.currentProfit, props.expectedProfit],
      backgroundColor: ['#66bb6a', '#f57c00'],
      borderRadius: 8,
      barThickness: 48,
    },
  ],
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: { parsed: { y: number | null } }) =>
          formatUsd(ctx.parsed.y ?? 0),
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      title: { display: true, text: 'USD' },
      grid: { color: 'rgba(0,0,0,0.06)' },
    },
    x: { grid: { display: false } },
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
  height: 260px;
  width: 100%;
}
</style>
