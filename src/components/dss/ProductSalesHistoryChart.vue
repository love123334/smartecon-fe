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
import { CHART_COLORS, baseChartOptions } from '@/utils/chartDefaults'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

export interface SalesHistoryPoint {
  day: number
  qty: number
  date?: string
}

const props = defineProps<{
  historical: SalesHistoryPoint[]
}>()

function formatLabel(pt: SalesHistoryPoint): string {
  if (pt.date) {
    const d = new Date(pt.date)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
    }
    return String(pt.date)
  }
  return `Ngày ${pt.day}`
}

const chartData = computed(() => ({
  labels: props.historical.map(formatLabel),
  datasets: [
    {
      label: 'Doanh số lịch sử',
      data: props.historical.map((h) => h.qty),
      borderColor: CHART_COLORS.primary,
      backgroundColor: CHART_COLORS.primarySoft,
      borderWidth: 2.5,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: '#fff',
      pointBorderColor: CHART_COLORS.primary,
      pointBorderWidth: 2,
      tension: 0.35,
      fill: true,
    },
  ],
}))

const options = baseChartOptions({
  plugins: {
    legend: { position: 'bottom' },
  },
  scales: {
    x: {
      title: { display: true, text: 'Thời gian', color: CHART_COLORS.tick, font: { size: 11 } },
    },
    y: {
      title: { display: true, text: 'Số lượng bán', color: CHART_COLORS.tick, font: { size: 11 } },
    },
  },
})
</script>

<template>
  <div class="chart-wrap">
    <Line :data="chartData" :options="options" />
  </div>
</template>

<style scoped>
.chart-wrap {
  height: 320px;
  width: 100%;
  padding: 0.25rem 0.15rem 0;
}
</style>
