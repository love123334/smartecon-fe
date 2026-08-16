<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { dssApi, formatVnd, sellerApi } from '@/api/services'
import type { ChartPoint } from '@/types'
import type { SalesPerformance, SellerDashboard } from '@/api/real/seller'
import { useAuthStore } from '@/stores/auth'
import LineChart from '@/components/LineChart.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'
import { backendStatusLabel } from '@/utils/backendOrderStatus'
import { dedupeRecentSellerOrders } from '@/utils/orderAnalytics'

const auth = useAuthStore()
const salesData = ref<ChartPoint[]>([])
const performance = ref<SalesPerformance | null>(null)
const dashboard = ref<SellerDashboard | null>(null)
const error = ref('')
const loading = ref(true)

const sellerKey = computed(() => auth.user?.backendId ?? auth.user?.id)

const recentOrders = computed(() =>
  dedupeRecentSellerOrders(dashboard.value?.recentOrders ?? []),
)

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    const [perf, dash] = await Promise.all([
      sellerApi.getSalesPerformance().catch(() => null),
      sellerApi.getDashboard().catch(() => null),
    ])
    dashboard.value = dash
    if (perf) {
      performance.value = perf
      salesData.value = perf.monthlyRevenue
    } else {
      salesData.value = await dssApi.salesChart(sellerKey.value)
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được doanh số'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="sales-page">
    <PageHeader
      eyebrow="Người bán"
      title="Doanh số"
      lead="Doanh thu đã giao, đơn và hiệu suất shop — một khung nhìn gọn."
    />
    <p v-if="error" class="form-error">{{ error }}</p>
    <LoadingSpinner v-if="loading" label="Đang tải" />

    <section v-if="performance || dashboard" class="sales-hero" aria-label="Chỉ số chính">
      <div class="sales-hero__main">
        <span class="sales-hero__label">Doanh thu đã giao</span>
        <strong class="sales-hero__value">
          {{ formatVnd(performance?.summary.totalRevenue ?? dashboard?.revenue.totalRevenue ?? 0) }}
        </strong>
      </div>
      <div class="sales-hero__side">
        <div>
          <span class="sales-hero__label">Đơn hoàn thành</span>
          <strong>{{ performance?.summary.completedOrders ?? dashboard?.revenue.completedOrders ?? 0 }}</strong>
        </div>
        <div>
          <span class="sales-hero__label">Giá trị đơn TB</span>
          <strong>{{ formatVnd(performance?.summary.averageOrderValue ?? 0) }}</strong>
        </div>
        <div v-if="dashboard">
          <span class="sales-hero__label">Đánh giá</span>
          <strong>
            {{ dashboard.averageRating != null ? dashboard.averageRating.toFixed(1) : '—' }}
            <small v-if="dashboard.totalReviews" class="muted">/ {{ dashboard.totalReviews }}</small>
          </strong>
        </div>
      </div>
    </section>

    <section v-if="dashboard" class="sales-pipeline" aria-label="Trạng thái đơn & tồn">
      <div class="sales-pipe">
        <span>Chờ</span>
        <strong>{{ dashboard.orders.pending }}</strong>
      </div>
      <div class="sales-pipe">
        <span>Xử lý</span>
        <strong>{{ dashboard.orders.processing }}</strong>
      </div>
      <div class="sales-pipe">
        <span>Đang giao</span>
        <strong>{{ dashboard.orders.shipping }}</strong>
      </div>
      <div class="sales-pipe sales-pipe--ok">
        <span>Đã giao</span>
        <strong>{{ dashboard.orders.delivered }}</strong>
      </div>
      <div class="sales-pipe">
        <span>SP active</span>
        <strong>{{ dashboard.products.activeProducts }}/{{ dashboard.products.totalProducts }}</strong>
      </div>
      <div class="sales-pipe" :class="{ 'sales-pipe--warn': dashboard.inventory.lowStockCount > 0 }">
        <span>Sắp hết / hết</span>
        <strong>{{ dashboard.inventory.lowStockCount }}/{{ dashboard.inventory.outOfStockCount }}</strong>
      </div>
    </section>

    <p v-if="dashboard?.ratingWarning" class="alert alert-error" style="margin-top: 1rem">
      {{ dashboard.ratingWarning }}
    </p>

    <div class="sales-grid">
      <section class="sales-panel">
        <h2>Doanh thu theo tháng</h2>
        <LineChart v-if="salesData.length" :data="salesData" label="Doanh thu (VND)" />
        <p v-else class="muted">Chưa có dữ liệu biểu đồ (cần đơn đã giao).</p>
      </section>

      <section v-if="performance?.topProducts.length" class="sales-panel">
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
      </section>
    </div>

    <div class="sales-grid" style="margin-top: 1rem">
      <section v-if="recentOrders.length" class="sales-panel">
        <h2>Đơn gần đây</h2>
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Khách</th>
                <th>Tổng</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="o in recentOrders" :key="o.orderId">
                <td>#{{ o.orderId }}</td>
                <td>{{ o.customer }}</td>
                <td>{{ formatVnd(o.total) }}</td>
                <td>{{ backendStatusLabel(o.status) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <RouterLink to="/seller/orders" class="btn btn-outline btn-sm" style="margin-top: 0.75rem">
          Quản lý đơn hàng →
        </RouterLink>
      </section>

      <section v-if="dashboard?.recentReviews.length" class="sales-panel">
        <h2>Đánh giá gần đây</h2>
        <ul class="review-list">
          <li v-for="r in dashboard.recentReviews" :key="r.id">
            <strong>{{ r.productName }}</strong> · {{ r.rating }}★
            <p class="muted">{{ r.comment }}</p>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.sales-page {
  max-width: 1100px;
}
.sales-hero {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 1rem;
  margin: 0.5rem 0 1rem;
  padding: 1.15rem 1.25rem;
  border-radius: 14px;
  background:
    linear-gradient(135deg, rgba(13, 148, 136, 0.08), rgba(30, 64, 175, 0.06)),
    #fff;
  border: 1px solid #e2e8f0;
}
.sales-hero__label {
  display: block;
  font-size: 0.78rem;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 0.25rem;
}
.sales-hero__value {
  font-size: clamp(1.45rem, 2.5vw, 1.85rem);
  font-weight: 750;
  color: #0f172a;
  letter-spacing: -0.02em;
}
.sales-hero__side {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  align-items: end;
}
.sales-hero__side strong {
  font-size: 1.05rem;
  color: #0f172a;
}
.sales-pipeline {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.55rem;
}
.sales-pipe {
  padding: 0.7rem 0.75rem;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #e2e8f0;
}
.sales-pipe span {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 0.2rem;
}
.sales-pipe strong {
  font-size: 1.05rem;
  color: #0f172a;
}
.sales-pipe--ok {
  border-color: #99f6e4;
  background: #f0fdfa;
}
.sales-pipe--warn {
  border-color: #fecaca;
  background: #fff7f7;
}
.sales-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 1rem;
}
.sales-panel {
  padding: 1rem 1.1rem;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
}
h2 {
  margin: 0 0 0.85rem;
  font-size: 0.95rem;
}
.review-list {
  margin: 0;
  padding-left: 1.1rem;
}
.muted {
  color: var(--slate-500, #64748b);
  font-size: 0.85rem;
  font-weight: 400;
}
@media (max-width: 900px) {
  .sales-hero,
  .sales-grid {
    grid-template-columns: 1fr;
  }
  .sales-pipeline {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .sales-hero__side {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .sales-pipeline,
  .sales-hero__side {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
