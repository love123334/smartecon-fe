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
import { CHART_COLORS, baseLineChartOptions } from '@/utils/chartDefaults'

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
      borderColor: CHART_COLORS.primary,
      backgroundColor: CHART_COLORS.primarySoft,
      fill: true,
      tension: 0.35,
      borderWidth: 2.5,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: '#fff',
      pointBorderColor: CHART_COLORS.primary,
      pointBorderWidth: 2,
    },
  ],
}))

const options = baseLineChartOptions({
  plugins: {
    legend: { display: Boolean(props.label) },
  },
})
</script>

<template>
  <div class="chart-box">
    <Line :data="chartData" :options="options" />
  </div>
</template>
