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
import type { ChartPoint } from '@/types'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

const props = withDefaults(
  defineProps<{
    data: ChartPoint[]
    label?: string
  }>(),
  { label: 'Giá trị' },
)

const chartData = computed(() => ({
  labels: props.data.map((d) => d.label),
  datasets: [
    {
      label: props.label,
      data: props.data.map((d) => d.value),
      borderColor: '#0d9488',
      backgroundColor: 'rgba(13, 148, 136, 0.15)',
      fill: true,
      tension: 0.3,
    },
  ],
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true },
  },
}
</script>

<template>
  <div class="chart-box">
    <Line :data="chartData" :options="options" />
  </div>
</template>
