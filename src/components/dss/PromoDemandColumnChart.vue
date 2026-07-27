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
import type { PromoScenarioRow } from '@/utils/dssManagerWhatIfMock'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const props = defineProps<{ rows: PromoScenarioRow[] }>()

const chartData = computed(() => ({
  labels: props.rows.map((r) => `${r.discountPct}%`),
  datasets: [
    {
      label: 'Nhu cầu dự báo',
      data: props.rows.map((r) => r.predictedDemand),
      backgroundColor: '#1976d2',
      borderRadius: 6,
    },
  ],
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: {
      title: { display: true, text: 'Mức giảm giá' },
      grid: { display: false },
    },
    y: {
      beginAtZero: true,
      title: { display: true, text: 'Đơn vị' },
      grid: { color: 'rgba(0,0,0,0.06)' },
    },
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
