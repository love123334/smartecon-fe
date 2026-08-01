<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { platformRevenueApi } from '@/api/services'
import type {
  PlatformRevenueDashboard,
  PlatformRevenueDashboardQuery,
} from '@/api/real/platformRevenue'
import PageHeader from '@/components/PageHeader.vue'
import PlatformRevenueFilter from '@/components/platform-revenue/PlatformRevenueFilter.vue'
import PlatformRevenueKpis from '@/components/platform-revenue/PlatformRevenueKpis.vue'
import PlatformRevenueTrendChart from '@/components/platform-revenue/PlatformRevenueTrendChart.vue'
import PlatformOrderStatusChart from '@/components/platform-revenue/PlatformOrderStatusChart.vue'
import PlatformPaymentChart from '@/components/platform-revenue/PlatformPaymentChart.vue'
import PlatformActivitySection from '@/components/platform-revenue/PlatformActivitySection.vue'
import PlatformActivityTrendChart from '@/components/platform-revenue/PlatformActivityTrendChart.vue'
import PlatformRankingTables from '@/components/platform-revenue/PlatformRankingTables.vue'
import {
  defaultPlatformRevenueFilter,
  formatGeneratedAt,
  mapPlatformRevenueError,
} from '@/utils/platformRevenue'

const filter = ref<PlatformRevenueDashboardQuery>(defaultPlatformRevenueFilter())
const data = ref<PlatformRevenueDashboard | null>(null)
const initialLoading = ref(true)
const filterLoading = ref(false)
const error = ref('')
const hasLoadedOnce = ref(false)

let requestSeq = 0

const loading = computed(() => initialLoading.value || filterLoading.value)
const generatedAt = computed(() => formatGeneratedAt(data.value?.period.generatedAt))

const orderStatus = computed(() => data.value?.orderStatusDistribution ?? [])
const revenueTrend = computed(() => data.value?.revenueTrend ?? [])
const activityTrend = computed(() => data.value?.activityTrend ?? [])
const payments = computed(() => data.value?.paymentMethodDistribution ?? [])
const sellers = computed(() => data.value?.topSellers ?? [])
const products = computed(() => data.value?.topProducts ?? [])
const categories = computed(() => data.value?.topCategories ?? [])

onMounted(() => {
  void loadDashboard(filter.value, true)
})

async function loadDashboard(query: PlatformRevenueDashboardQuery, isInitial = false) {
  const seq = ++requestSeq
  error.value = ''
  if (isInitial) initialLoading.value = true
  else filterLoading.value = true

  try {
    const result = await platformRevenueApi.getDashboard(query)
    if (seq !== requestSeq) return
    data.value = result
    filter.value = {
      fromDate: result.period?.fromDate ?? query.fromDate,
      toDate: result.period?.toDate ?? query.toDate,
      granularity: result.period?.granularity ?? query.granularity,
      topLimit: query.topLimit,
    }
    hasLoadedOnce.value = true
  } catch (e) {
    if (seq !== requestSeq) return
    error.value = mapPlatformRevenueError(e)
    if (!hasLoadedOnce.value) data.value = null
  } finally {
    if (seq === requestSeq) {
      initialLoading.value = false
      filterLoading.value = false
    }
  }
}

function onApply(query: PlatformRevenueDashboardQuery) {
  filter.value = query
  void loadDashboard(query, false)
}

function retry() {
  void loadDashboard(filter.value, !hasLoadedOnce.value)
}
</script>

<template>
  <div class="pr-page">
    <PageHeader
      eyebrow="Quản lý"
      title="Platform Revenue Management"
      lead="Theo dõi doanh số và hoạt động tổng thể của sàn"
    >
      <template #actions>
        <p v-if="data" class="pr-generated muted">
          Báo cáo tạo lúc: <strong>{{ generatedAt }}</strong>
        </p>
      </template>
    </PageHeader>

    <PlatformRevenueFilter v-model="filter" :loading="loading" @apply="onApply" />

    <div v-if="error" class="card pr-error-card" role="alert">
      <p>{{ error }}</p>
      <button type="button" class="btn btn-outline btn-sm" :disabled="loading" @click="retry">
        Thử lại
      </button>
    </div>

    <p v-if="initialLoading && !data" class="muted" role="status">Đang tải báo cáo toàn sàn…</p>

    <template v-else-if="data">
      <div v-if="filterLoading" class="pr-loading-bar" role="status">Đang cập nhật theo bộ lọc…</div>

      <PlatformRevenueKpis :overview="data.overview" />

      <div class="pr-grid-2">
        <PlatformRevenueTrendChart
          :trend="revenueTrend"
          :granularity="filter.granularity"
        />
        <PlatformOrderStatusChart :items="orderStatus" />
      </div>

      <PlatformPaymentChart :items="payments" />

      <PlatformActivitySection
        v-if="data.platformActivity"
        :activity="data.platformActivity"
      />

      <PlatformActivityTrendChart
        :trend="activityTrend"
        :granularity="filter.granularity"
      />

      <PlatformRankingTables
        :sellers="sellers"
        :products="products"
        :categories="categories"
      />
    </template>

    <div
      v-else-if="!initialLoading && !error"
      class="card"
      role="status"
    >
      <p class="muted" style="margin: 0">
        Chưa có dữ liệu báo cáo. Điều chỉnh bộ lọc rồi bấm “Áp dụng”.
      </p>
    </div>
  </div>
</template>

<style scoped>
.pr-page {
  padding-bottom: 2rem;
}
.pr-generated {
  margin: 0;
  font-size: 0.875rem;
}
.pr-generated strong {
  color: #0f172a;
}
.pr-error-card {
  margin: 1rem 0;
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.pr-error-card p {
  margin: 0;
  font-weight: 600;
}
.pr-loading-bar {
  margin: 0 0 0.85rem;
  padding: 0.55rem 0.85rem;
  border-radius: 8px;
  background: #ecfdf5;
  color: #0f766e;
  font-size: 0.85rem;
  font-weight: 600;
}
.pr-grid-2 {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 1rem;
  margin-bottom: 1.25rem;
}
.pr-grid-2 > * {
  margin-bottom: 0;
}
@media (max-width: 960px) {
  .pr-grid-2 {
    grid-template-columns: 1fr;
  }
}
</style>
