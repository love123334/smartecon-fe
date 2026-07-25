<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { dssApi, formatVnd, sellerApi } from '@/api/services'
import type { ChartPoint } from '@/types'
import type { SalesPerformance } from '@/api/real/seller'
import { useAuthStore } from '@/stores/auth'
import HybridDataNotice from '@/components/HybridDataNotice.vue'
import LineChart from '@/components/LineChart.vue'
import PageHeader from '@/components/PageHeader.vue'

const auth = useAuthStore()
const salesData = ref<ChartPoint[]>([])
const performance = ref<SalesPerformance | null>(null)
const fromApi = ref(false)

const sellerKey = computed(() => auth.user?.backendId ?? auth.user?.id)

onMounted(async () => {
  const perf = await sellerApi.getSalesPerformance()
  if (perf) {
    performance.value = perf
    salesData.value = perf.monthlyRevenue
    fromApi.value = true
    return
  }
  salesData.value = await dssApi.salesChart(sellerKey.value)
})
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Người bán"
      title="Bảng doanh số"
      lead="Doanh thu và sản phẩm bán chạy từ API seller/sales-performance."
    />
    <HybridDataNotice
      :message="
        fromApi
          ? 'Dữ liệu từ GET /api/v1/seller/sales-performance.'
          : 'Backend chưa phản hồi — hiển thị ước tính từ catalog.'
      "
    />

    <div v-if="performance" class="stat-grid grid-stagger">
      <div class="card stat-card stat-card--hover">
        <span class="stat-label">Doanh thu</span>
        <span class="stat-value">{{ formatVnd(performance.summary.totalRevenue) }}</span>
      </div>
      <div class="card stat-card stat-card--hover">
        <span class="stat-label">Đơn hoàn thành</span>
        <span class="stat-value">{{ performance.summary.completedOrders }}</span>
      </div>
      <div class="card stat-card stat-card--hover">
        <span class="stat-label">AOV</span>
        <span class="stat-value">{{ formatVnd(performance.summary.averageOrderValue) }}</span>
      </div>
    </div>

    <div class="card">
      <h2>Doanh thu theo tháng</h2>
      <LineChart v-if="salesData.length" :data="salesData" label="Doanh thu (VND)" />
      <p v-else class="muted">Chưa có dữ liệu biểu đồ.</p>
    </div>

    <div v-if="performance?.topProducts.length" class="card" style="margin-top: 1rem">
      <h2>Sản phẩm bán chạy</h2>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Sản phẩm</th>
              <th>Đã bán</th>
              <th>Doanh thu</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in performance.topProducts" :key="p.productId">
              <td>{{ p.productName }}</td>
              <td>{{ p.quantitySold }}</td>
              <td>{{ formatVnd(p.revenue) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 1rem;
  font-size: 1rem;
}
</style>
