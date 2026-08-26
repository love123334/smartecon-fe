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
import type { RevenueGranularity, RevenueTrendPoint } from '@/api/real/platformRevenue'
import { formatPeriodLabel, formatPlatformNumber, formatPlatformVnd } from '@/utils/platformRevenue'
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

const props = defineProps<{
  trend: RevenueTrendPoint[]
  granularity: RevenueGranularity
}>()

const hasData = computed(() => props.trend.length > 0)

const chartData = computed(() => ({
  labels: props.trend.map((p) => formatPeriodLabel(p.periodStart, props.granularity)),
  datasets: [
    {
      label: 'GMV',
      data: props.trend.map((p) => Number(p.grossMerchandiseValue) || 0),
      borderColor: CHART_COLORS.success,
      backgroundColor: CHART_COLORS.successSoft,
      fill: true,
      tension: 0.35,
      borderWidth: 2.5,
      pointRadius: 2,
      pointHoverRadius: 5,
    },
    {
      label: 'Giá trị đơn hàng đã giao',
      data: props.trend.map((p) => Number(p.deliveredOrderValue) || 0),
      borderColor: CHART_COLORS.primary,
      backgroundColor: CHART_COLORS.primarySoft,
      fill: true,
      tension: 0.35,
      borderWidth: 2.5,
      pointRadius: 2,
      pointHoverRadius: 5,
    },
  ],
}))

const options = computed(() =>
  baseLineChartOptions({
    plugins: {
      legend: { display: true, position: 'bottom' },
      tooltip: {
        callbacks: {
          afterBody(items: { dataIndex: number }[]) {
            const idx = items[0]?.dataIndex
            if (idx == null) return []
            const row = props.trend[idx]
            if (!row) return []
            return [
              `Đơn đã giao: ${formatPlatformNumber(row.deliveredOrders)}`,
              `Sản phẩm bán: ${formatPlatformNumber(row.unitsSold)}`,
            ]
          },
          label(ctx: { dataset: { label?: string }; parsed: { y: number | null } }) {
            const label = ctx.dataset.label ?? ''
            const y = ctx.parsed.y
            return `${label}: ${formatPlatformVnd(y)}`
          },
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback(value: string | number) {
            const n = Number(value)
            if (!Number.isFinite(n)) return value
            return new Intl.NumberFormat('vi-VN', {
              notation: 'compact',
              maximumFractionDigits: 1,
            }).format(n)
          },
        },
      },
    },
  }),
)
</script>

<template>
  <section class="card" aria-labelledby="pr-revenue-trend-title">
    <h2 id="pr-revenue-trend-title" class="pr-section-title">Lịch sử doanh thu</h2>
    <p class="muted pr-sub">
      GMV và giá trị đơn hàng đã giao theo {{ granularity === 'MONTH' ? 'tháng' : 'ngày' }} — không phải lợi nhuận sàn.
    </p>
    <div v-if="hasData" class="chart-box">
      <Line :data="chartData" :options="options" />
    </div>
    <p v-else class="muted">Chưa có dữ liệu xu hướng trong khoảng đã chọn.</p>
  </section>
</template>

<style scoped>
.pr-section-title {
  margin: 0 0 0.35rem;
  font-size: 1rem;
}
.pr-sub {
  margin: 0 0 0.85rem;
  font-size: 0.85rem;
}
.chart-box {
  height: 280px;
  position: relative;
}
</style>
