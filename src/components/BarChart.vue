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
      backgroundColor: 'rgba(13, 148, 136, 0.7)',
      borderColor: '#0f766e',
      borderWidth: 1,
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
    <Bar :data="chartData" :options="options" />
  </div>
</template>
