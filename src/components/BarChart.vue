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
import type { ChartPoint } from '@/types'
import { CHART_COLORS, baseBarChartOptions } from '@/utils/chartDefaults'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

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
      backgroundColor: CHART_COLORS.primarySoft,
      borderColor: CHART_COLORS.primary,
      borderWidth: 1.5,
      borderRadius: 6,
      maxBarThickness: 48,
    },
  ],
}))

const options = baseBarChartOptions({
  plugins: {
    legend: { display: Boolean(props.label) },
  },
})
</script>

<template>
  <div class="chart-box">
    <Bar :data="chartData" :options="options" />
  </div>
</template>
