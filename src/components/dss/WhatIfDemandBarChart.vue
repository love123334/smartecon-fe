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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const props = defineProps<{
  currentDemand: number
  predictedDemand: number
}>()

const chartData = computed(() => ({
  labels: ['Nhu cầu hiện tại', 'Nhu cầu dự báo'],
  datasets: [
    {
      label: 'Số lượng (đơn vị)',
      data: [props.currentDemand, props.predictedDemand],
      backgroundColor: ['#90caf9', '#1976d2'],
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
  },
  scales: {
    y: {
      beginAtZero: true,
      title: { display: true, text: 'Đơn vị' },
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
