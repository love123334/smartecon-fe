<script setup lang="ts">
import { computed } from 'vue'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut } from 'vue-chartjs'
import type { PaymentMethodDistributionItem } from '@/api/real/platformRevenue'
import {
  formatPlatformNumber,
  formatPlatformPercent,
  formatPlatformVnd,
  paymentMethodLabel,
} from '@/utils/platformRevenue'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps<{
  items: PaymentMethodDistributionItem[]
}>()

const COLORS = ['#2563eb', '#a855f7', '#0d9488', '#f59e0b', '#ef4444']

const hasData = computed(() => props.items.some((i) => Number(i.successfulAmount) > 0))

const chartData = computed(() => ({
  labels: props.items.map((i) => paymentMethodLabel(i.paymentMethod)),
  datasets: [
    {
      data: props.items.map((i) => Number(i.successfulAmount) || 0),
      backgroundColor: props.items.map((_, idx) => COLORS[idx % COLORS.length]),
      borderWidth: 1,
      borderColor: '#fff',
    },
  ],
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const },
  },
}
</script>

<template>
  <section class="card pr-pay" aria-labelledby="pr-payment-title">
    <h2 id="pr-payment-title" class="pr-section-title">Payment Method Distribution</h2>
    <div class="pr-split">
      <div v-if="hasData" class="chart-box">
        <Doughnut :data="chartData" :options="options" />
      </div>
      <p v-else class="muted">Chưa có tỷ trọng thanh toán thành công.</p>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Method</th>
              <th>Total</th>
              <th>Success</th>
              <th>Pending</th>
              <th>Failed</th>
              <th>Successful amount</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in items" :key="row.paymentMethod">
              <td>{{ paymentMethodLabel(row.paymentMethod) }}</td>
              <td>{{ formatPlatformNumber(row.totalPaymentCount) }}</td>
              <td>{{ formatPlatformNumber(row.successfulPaymentCount) }}</td>
              <td>{{ formatPlatformNumber(row.pendingPaymentCount) }}</td>
              <td>{{ formatPlatformNumber(row.failedPaymentCount) }}</td>
              <td>{{ formatPlatformVnd(row.successfulAmount) }}</td>
              <td>{{ formatPlatformPercent(row.percentage) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pr-pay {
  margin-bottom: 1.25rem;
}
.pr-section-title {
  margin: 0 0 0.85rem;
  font-size: 1rem;
}
.pr-split {
  display: grid;
  grid-template-columns: minmax(220px, 0.8fr) minmax(0, 1.4fr);
  gap: 1rem;
  align-items: start;
}
.chart-box {
  height: 240px;
  position: relative;
}
.table-wrap {
  overflow-x: auto;
}
@media (max-width: 900px) {
  .pr-split {
    grid-template-columns: 1fr;
  }
}
</style>
