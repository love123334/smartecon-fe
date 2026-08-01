<script setup lang="ts">
import type { PlatformRevenueOverview } from '@/api/real/platformRevenue'
import {
  GMV_TOOLTIP,
  formatPlatformNumber,
  formatPlatformPercent,
  formatPlatformVnd,
} from '@/utils/platformRevenue'

defineProps<{
  overview: PlatformRevenueOverview
}>()
</script>

<template>
  <section class="pr-kpis" aria-label="KPI tổng quan sàn">
    <article class="card stat-card">
      <span class="stat-label" :title="GMV_TOOLTIP">Gross Merchandise Value</span>
      <span class="stat-value">{{ formatPlatformVnd(overview.grossMerchandiseValue) }}</span>
      <small class="pr-hint">{{ GMV_TOOLTIP }}</small>
    </article>

    <article class="card stat-card">
      <span class="stat-label">GMV Growth</span>
      <template v-if="overview.gmvGrowthPercentage == null">
        <span class="stat-value muted">Chưa có dữ liệu kỳ trước</span>
      </template>
      <template v-else>
        <span
          class="stat-value"
          :class="{
            'pr-growth--up': overview.gmvGrowthPercentage > 0,
            'pr-growth--down': overview.gmvGrowthPercentage < 0,
          }"
        >
          {{ formatPlatformPercent(overview.gmvGrowthPercentage, { signed: true }) }}
        </span>
      </template>
    </article>

    <article class="card stat-card">
      <span class="stat-label">Successful Payment Amount</span>
      <span class="stat-value">{{ formatPlatformVnd(overview.successfulPaymentAmount) }}</span>
      <small class="pr-hint">Gross payment volume đã thanh toán thành công — không phải lợi nhuận sàn.</small>
    </article>

    <article class="card stat-card">
      <span class="stat-label">Delivered / Total Orders</span>
      <span class="stat-value">
        {{ formatPlatformNumber(overview.deliveredOrders) }}
        /
        {{ formatPlatformNumber(overview.totalOrders) }}
      </span>
    </article>

    <article class="card stat-card">
      <span class="stat-label">Average Order Value</span>
      <span class="stat-value">{{ formatPlatformVnd(overview.averageOrderValue) }}</span>
    </article>

    <article class="card stat-card">
      <span class="stat-label">Units Sold</span>
      <span class="stat-value">{{ formatPlatformNumber(overview.unitsSold) }}</span>
    </article>

    <article class="card stat-card">
      <span class="stat-label">Active Sellers</span>
      <span class="stat-value">{{ formatPlatformNumber(overview.activeSellerCount) }}</span>
    </article>

    <article class="card stat-card">
      <span class="stat-label">Active Customers</span>
      <span class="stat-value">{{ formatPlatformNumber(overview.activeCustomerCount) }}</span>
    </article>
  </section>
</template>

<style scoped>
.pr-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem;
  margin-bottom: 1.25rem;
}
.pr-hint {
  display: block;
  margin-top: 0.4rem;
  font-size: 0.72rem;
  font-weight: 500;
  color: #64748b;
  line-height: 1.35;
}
.pr-growth--up {
  color: #15803d !important;
}
.pr-growth--down {
  color: #c2410c !important;
}
.muted {
  color: #64748b !important;
  font-size: 1rem !important;
}
@media (max-width: 1100px) {
  .pr-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .pr-kpis {
    grid-template-columns: 1fr;
  }
}
</style>
