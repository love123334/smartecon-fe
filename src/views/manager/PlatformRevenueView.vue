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
import PlatformRankingTables from '@/components/platform-revenue/PlatformRankingTables.vue'
import PlatformOrderStatusChart from '@/components/platform-revenue/PlatformOrderStatusChart.vue'
import PlatformActivitySection from '@/components/platform-revenue/PlatformActivitySection.vue'
import LookerStudioEmbed from '@/components/LookerStudioEmbed.vue'
import {
  LOOKER_STUDIO_PLATFORM_REVENUE_URL,
} from '@/constants/lookerStudio'
import {
  defaultPlatformRevenueFilter,
  formatGeneratedAt,
  mapPlatformRevenueError,
} from '@/utils/platformRevenue'

const LOOKER_STUDIO_EMBED_URL = LOOKER_STUDIO_PLATFORM_REVENUE_URL

/** Looker + báo cáo native (bộ lọc / KPI / chart). */
const SHOW_NATIVE_PLATFORM_REPORT = true

const filter = ref<PlatformRevenueDashboardQuery>(defaultPlatformRevenueFilter())
const data = ref<PlatformRevenueDashboard | null>(null)
const initialLoading = ref(true)
const filterLoading = ref(false)
const error = ref('')
const hasLoadedOnce = ref(false)

let requestSeq = 0

const loading = computed(() => initialLoading.value || filterLoading.value)
const generatedAt = computed(() => formatGeneratedAt(data.value?.period.generatedAt))

const revenueTrend = computed(() => data.value?.revenueTrend ?? [])
const sellers = computed(() => data.value?.topSellers ?? [])
const products = computed(() => data.value?.topProducts ?? [])
const categories = computed(() => data.value?.topCategories ?? [])
const orderStatuses = computed(() => data.value?.orderStatusDistribution ?? [])
const activity = computed(() => data.value?.platformActivity ?? null)

onMounted(() => {
  if (SHOW_NATIVE_PLATFORM_REPORT) {
    void loadDashboard(filter.value, true)
  } else {
    initialLoading.value = false
  }
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
      title="Doanh thu sàn"
      lead="Báo cáo Looker Studio nhúng — tổng quan GMV và vận hành toàn nền tảng."
    >
      <template v-if="SHOW_NATIVE_PLATFORM_REPORT && data" #actions>
        <p class="pr-generated muted">
          Báo cáo tạo lúc: <strong>{{ generatedAt }}</strong>
        </p>
      </template>
    </PageHeader>

    <section class="pr-looker card" aria-label="Looker Studio — Doanh thu sàn">
      <div class="pr-looker__head">
        <div>
          <h2 class="pr-looker__title">Doanh thu sàn · Looker Studio</h2>
          <p class="pr-looker__lead muted">
            Báo cáo tổng hợp nhúng từ Google Looker Studio
          </p>
        </div>
        <a
          class="btn btn-outline btn-sm"
          :href="LOOKER_STUDIO_EMBED_URL"
          target="_blank"
          rel="noopener noreferrer"
        >
          Mở báo cáo đầy đủ
        </a>
      </div>
      <LookerStudioEmbed
        :src="LOOKER_STUDIO_PLATFORM_REVENUE_URL"
        title="Doanh thu sàn — Looker Studio"
      />
    </section>

    <template v-if="SHOW_NATIVE_PLATFORM_REPORT">
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

        <PlatformRevenueTrendChart
          :trend="revenueTrend"
          :granularity="filter.granularity"
        />

        <PlatformRankingTables
          :sellers="sellers"
          :products="products"
          :categories="categories"
        />

        <PlatformOrderStatusChart v-if="orderStatuses.length" :items="orderStatuses" />
        <PlatformActivitySection v-if="activity" :activity="activity" />
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
    </template>
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
.pr-looker {
  margin: 0 0 1.25rem;
  padding: 1rem 1.1rem 1.15rem;
  overflow: hidden;
}
.pr-looker__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  margin-bottom: 0.85rem;
}
.pr-looker__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--navy, #14275c);
}
.pr-looker__lead {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
}
.pr-looker__frame-wrap {
  position: relative;
  width: 100%;
  height: var(--looker-h, 480px);
  border: 1px solid var(--line, #e4e9f2);
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}
.pr-looker__loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  font-size: 0.9rem;
  pointer-events: none;
  z-index: 1;
}
.pr-looker__fallback {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin: 0;
  padding: 1rem;
  background: rgba(248, 250, 252, 0.96);
  text-align: center;
  font-size: 0.9rem;
  color: #475569;
}
.pr-looker__frame {
  display: block;
  width: 100%;
  height: var(--looker-h, 480px);
  border: none;
  background: #fff;
}
@media (max-width: 768px) {
  .pr-looker__frame-wrap {
    --looker-h: 400px;
  }
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
