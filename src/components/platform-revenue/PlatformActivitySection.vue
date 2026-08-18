<script setup lang="ts">
import type { PlatformActivity } from '@/api/real/platformRevenue'
import { formatPlatformNumber } from '@/utils/platformRevenue'

defineProps<{
  activity: PlatformActivity
}>()
</script>

<template>
  <section class="pr-activity" aria-label="Hoạt động nền tảng">
    <article class="card">
      <h2 class="pr-section-title">Hoạt động người dùng</h2>
      <p class="muted pr-note">
        Tài khoản đang hoạt động là tài khoản trạng thái Active — không phải số người đang online.
      </p>
      <div class="pr-mini-grid">
        <div><span>Tổng người bán</span><strong>{{ formatPlatformNumber(activity.totalSellers) }}</strong></div>
        <div><span>Tài khoản người bán đang hoạt động</span><strong>{{ formatPlatformNumber(activity.activeSellerAccounts) }}</strong></div>
        <div><span>Người bán mới</span><strong>{{ formatPlatformNumber(activity.newSellers) }}</strong></div>
        <div><span>Tổng khách hàng</span><strong>{{ formatPlatformNumber(activity.totalCustomers) }}</strong></div>
        <div><span>Tài khoản khách đang hoạt động</span><strong>{{ formatPlatformNumber(activity.activeCustomerAccounts) }}</strong></div>
        <div><span>Khách hàng mới</span><strong>{{ formatPlatformNumber(activity.newCustomers) }}</strong></div>
      </div>
    </article>

    <article class="card">
      <h2 class="pr-section-title">Hoạt động sản phẩm</h2>
      <div class="pr-mini-grid">
        <div><span>Tổng sản phẩm</span><strong>{{ formatPlatformNumber(activity.totalProducts) }}</strong></div>
        <div><span>Đang bán</span><strong>{{ formatPlatformNumber(activity.activeProducts) }}</strong></div>
        <div><span>Ngừng bán</span><strong>{{ formatPlatformNumber(activity.inactiveProducts) }}</strong></div>
        <div><span>Hết hàng</span><strong>{{ formatPlatformNumber(activity.outOfStockProducts) }}</strong></div>
        <div><span>Sản phẩm mới</span><strong>{{ formatPlatformNumber(activity.newProducts) }}</strong></div>
        <div><span>Chưa phân loại</span><strong>{{ formatPlatformNumber(activity.uncategorizedProducts) }}</strong></div>
        <div><span>Tổng danh mục</span><strong>{{ formatPlatformNumber(activity.totalCategories) }}</strong></div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.pr-activity {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.25rem;
}
.pr-section-title {
  margin: 0 0 0.35rem;
  font-size: 1rem;
}
.pr-note {
  margin: 0 0 0.85rem;
  font-size: 0.8rem;
}
.pr-mini-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem 1rem;
}
.pr-mini-grid div {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.pr-mini-grid span {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
}
.pr-mini-grid strong {
  font-size: 1.1rem;
  color: #0f172a;
}
@media (max-width: 900px) {
  .pr-activity {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 560px) {
  .pr-mini-grid {
    grid-template-columns: 1fr;
  }
}
</style>
