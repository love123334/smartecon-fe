<script setup lang="ts">
import type { PlatformRevenueOverview } from '@/api/real/platformRevenue'
import { formatPlatformNumber, formatPlatformVnd } from '@/utils/platformRevenue'

defineProps<{
  overview: PlatformRevenueOverview
}>()
</script>

<template>
  <section class="pr-kpis" aria-label="KPI tổng quan sàn">
    <article class="card stat-card">
      <span class="stat-label">Người bán</span>
      <span class="stat-value">{{ formatPlatformNumber(overview.activeSellerCount) }}</span>
      <small class="pr-hint">Người bán có đơn đã giao trong kỳ đã chọn</small>
    </article>

    <article class="card stat-card">
      <span class="stat-label">Khách hàng</span>
      <span class="stat-value">{{ formatPlatformNumber(overview.activeCustomerCount) }}</span>
      <small class="pr-hint">Khách có đơn đã giao trong kỳ đã chọn</small>
    </article>

    <article class="card stat-card">
      <span class="stat-label">Sản phẩm đã bán</span>
      <span class="stat-value">{{ formatPlatformNumber(overview.unitsSold) }}</span>
    </article>

    <article class="card stat-card">
      <span class="stat-label">Giá trị trung bình đơn hàng</span>
      <span class="stat-value">{{ formatPlatformVnd(overview.averageOrderValue) }}</span>
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
