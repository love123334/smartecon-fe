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
import type { ChartData } from 'chart.js'
import { CHART_COLORS, baseLineChartOptions } from '@/utils/chartDefaults'
import { formatChartDayVi } from '@/utils/demandPrediction'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

export interface SalesHistoryPoint {
  day: number
  qty: number
  date?: string
}

const props = defineProps<{
  historical: SalesHistoryPoint[]
  forecast?: SalesHistoryPoint[]
}>()

function formatLabel(pt: SalesHistoryPoint): string {
  if (pt.date) {
    return formatChartDayVi(pt.date) || String(pt.date)
  }
  return `Ngày ${pt.day}`
}

const chartData = computed((): ChartData<'line'> => {
  const histLabels = props.historical.map(formatLabel)
  const forecastLabels = (props.forecast ?? []).map(formatLabel)
  const labels = [...histLabels, ...forecastLabels]

  const histData = props.historical.map((h) => h.qty)
  const forecastData = [
    ...Array(Math.max(histData.length - 1, 0)).fill(null),
    histData.length ? histData[histData.length - 1] : null,
    ...(props.forecast ?? []).map((f) => f.qty),
  ]

  const datasets: ChartData<'line'>['datasets'] = [
    {
      label: 'Bán thực tế',
      data: [...histData, ...Array(forecastLabels.length).fill(null)],
      borderColor: CHART_COLORS.primary,
      backgroundColor: CHART_COLORS.primarySoft,
      borderWidth: 2.5,
      pointRadius: 3,
      pointHoverRadius: 5,
      tension: 0.35,
      fill: true,
    },
  ]

  if (props.forecast?.length) {
    datasets.push({
      label: 'Dự báo (mùa vụ + lễ)',
      data: forecastData,
      borderColor: CHART_COLORS.warn,
      backgroundColor: CHART_COLORS.warnSoft,
      borderWidth: 2.5,
      pointRadius: 2,
      pointHoverRadius: 5,
      tension: 0.35,
      fill: false,
      borderDash: [6, 4],
    })
  }

  return { labels, datasets }
})

const options = baseLineChartOptions({
  plugins: {
    legend: { position: 'bottom' },
  },
  scales: {
    x: {
      title: { display: true, text: 'Thời gian', color: CHART_COLORS.tick, font: { size: 11 } },
    },
    y: {
      title: { display: true, text: 'Số lượng', color: CHART_COLORS.tick, font: { size: 11 } },
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
