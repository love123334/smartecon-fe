<script setup lang="ts">
import { ref } from 'vue'
import type {
  TopCategoryItem,
  TopProductItem,
  TopSellerItem,
} from '@/api/real/platformRevenue'
import {
  categoryDisplayName,
  formatPlatformNumber,
  formatPlatformPercent,
  formatPlatformVnd,
} from '@/utils/platformRevenue'

defineProps<{
  sellers: TopSellerItem[]
  products: TopProductItem[]
  categories: TopCategoryItem[]
}>()

const tab = ref<'sellers' | 'products' | 'categories'>('sellers')
</script>

<template>
  <section class="card" aria-labelledby="pr-ranking-title">
    <div class="pr-rank-head">
      <h2 id="pr-ranking-title" class="pr-section-title">Xếp hạng</h2>
      <div class="pr-tabs" role="tablist" aria-label="Bảng xếp hạng">
        <button
          type="button"
          role="tab"
          class="pr-tab"
          :class="{ 'pr-tab--active': tab === 'sellers' }"
          :aria-selected="tab === 'sellers'"
          @click="tab = 'sellers'"
        >
          Top người bán
        </button>
        <button
          type="button"
          role="tab"
          class="pr-tab"
          :class="{ 'pr-tab--active': tab === 'products' }"
          :aria-selected="tab === 'products'"
          @click="tab = 'products'"
        >
          Top sản phẩm
        </button>
        <button
          type="button"
          role="tab"
          class="pr-tab"
          :class="{ 'pr-tab--active': tab === 'categories' }"
          :aria-selected="tab === 'categories'"
          @click="tab = 'categories'"
        >
          Top danh mục
        </button>
      </div>
    </div>

    <div v-show="tab === 'sellers'" class="table-wrap" role="tabpanel">
      <table v-if="sellers.length" class="data">
        <thead>
          <tr>
            <th>Hạng</th>
            <th>Tên người bán</th>
            <th>GMV</th>
            <th>Đơn đã giao</th>
            <th>Sản phẩm bán</th>
            <th>Thị phần</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in sellers" :key="row.sellerId">
            <td>{{ idx + 1 }}</td>
            <td>{{ row.sellerName || '—' }}</td>
            <td>{{ formatPlatformVnd(row.grossMerchandiseValue) }}</td>
            <td>{{ formatPlatformNumber(row.deliveredOrders) }}</td>
            <td>{{ formatPlatformNumber(row.unitsSold) }}</td>
            <td>{{ formatPlatformPercent(row.marketSharePercentage) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="muted">Chưa có dữ liệu top người bán.</p>
    </div>

    <div v-show="tab === 'products'" class="table-wrap" role="tabpanel">
      <table v-if="products.length" class="data">
        <thead>
          <tr>
            <th>Hạng</th>
            <th>Tên sản phẩm</th>
            <th>Người bán</th>
            <th>Đơn đã giao</th>
            <th>Sản phẩm bán</th>
            <th>GMV</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in products" :key="row.productId">
            <td>{{ idx + 1 }}</td>
            <td>{{ row.productName || '—' }}</td>
            <td>{{ row.sellerName || '—' }}</td>
            <td>{{ formatPlatformNumber(row.deliveredOrders) }}</td>
            <td>{{ formatPlatformNumber(row.unitsSold) }}</td>
            <td>{{ formatPlatformVnd(row.grossMerchandiseValue) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="muted">Chưa có dữ liệu top sản phẩm.</p>
    </div>

    <div v-show="tab === 'categories'" class="table-wrap" role="tabpanel">
      <table v-if="categories.length" class="data">
        <thead>
          <tr>
            <th>Hạng</th>
            <th>Danh mục</th>
            <th>Đơn đã giao</th>
            <th>Sản phẩm bán</th>
            <th>GMV</th>
            <th>Thị phần</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, idx) in categories"
            :key="row.categoryId ?? `uncategorized-${idx}`"
          >
            <td>{{ idx + 1 }}</td>
            <td>{{ categoryDisplayName(row.categoryId, row.categoryName) }}</td>
            <td>{{ formatPlatformNumber(row.deliveredOrders) }}</td>
            <td>{{ formatPlatformNumber(row.unitsSold) }}</td>
            <td>{{ formatPlatformVnd(row.grossMerchandiseValue) }}</td>
            <td>{{ formatPlatformPercent(row.marketSharePercentage) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="muted">Chưa có dữ liệu top danh mục.</p>
    </div>
  </section>
</template>

<style scoped>
.pr-section-title {
  margin: 0;
  font-size: 1rem;
}
.pr-rank-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}
.pr-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.pr-tab {
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #475569;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 650;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  cursor: pointer;
}
.pr-tab--active {
  background: #ecfdf5;
  border-color: #99f6e4;
  color: #0f766e;
}
.pr-tab:focus-visible {
  outline: 2px solid #0d9488;
  outline-offset: 2px;
}
.table-wrap {
  overflow-x: auto;
}
</style>
