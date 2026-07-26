<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { dssApi, formatVnd, sellerApi } from '@/api/services'
import type { ChartPoint } from '@/types'
import type { SalesPerformance, SellerDashboard } from '@/api/real/seller'
import { useAuthStore } from '@/stores/auth'
import HybridDataNotice from '@/components/HybridDataNotice.vue'
import LineChart from '@/components/LineChart.vue'
import PageHeader from '@/components/PageHeader.vue'
import { backendStatusLabel } from '@/utils/backendOrderStatus'

const auth = useAuthStore()
const salesData = ref<ChartPoint[]>([])
const performance = ref<SalesPerformance | null>(null)
const dashboard = ref<SellerDashboard | null>(null)
const fromApi = ref(false)
const error = ref('')
const loading = ref(true)

const sellerKey = computed(() => auth.user?.backendId ?? auth.user?.id)

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
      fromApi.value = true
      if (!perf.monthlyRevenue.length && dash) {
        /* giữ chart trống nếu chưa có DELIVERED */
      }
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
  <div>
    <PageHeader
      eyebrow="Người bán"
      title="Bảng doanh số & hiệu suất"
      lead="Số liệu từ GET /seller/sales-performance và /seller/dashboard. Doanh thu hoàn thành tính đơn Đã giao."
    />
    <HybridDataNotice
      :message="
        fromApi
          ? 'Đã kết nối API seller. Cập nhật đơn sang Đã giao (Seller → Đơn hàng) để doanh thu phản ánh đúng.'
          : 'Backend chưa phản hồi sales-performance — hiển thị ước tính / dashboard khi có.'
      "
    />
    <p v-if="error" class="form-error">{{ error }}</p>
    <p v-if="loading" class="muted">Đang tải…</p>

    <div v-if="performance || dashboard" class="stat-grid grid-stagger">
      <div class="card stat-card stat-card--hover">
        <span class="stat-label">Doanh thu (đã giao)</span>
        <span class="stat-value">
          {{ formatVnd(performance?.summary.totalRevenue ?? dashboard?.revenue.totalRevenue ?? 0) }}
        </span>
      </div>
      <div class="card stat-card stat-card--hover">
        <span class="stat-label">Đơn hoàn thành</span>
        <span class="stat-value">
          {{ performance?.summary.completedOrders ?? dashboard?.revenue.completedOrders ?? 0 }}
        </span>
      </div>
      <div class="card stat-card stat-card--hover">
        <span class="stat-label">AOV</span>
        <span class="stat-value">
          {{ formatVnd(performance?.summary.averageOrderValue ?? 0) }}
        </span>
      </div>
      <div v-if="dashboard" class="card stat-card stat-card--hover">
        <span class="stat-label">Đánh giá shop</span>
        <span class="stat-value">
          {{ dashboard.averageRating != null ? dashboard.averageRating.toFixed(1) : '—' }}
          <small v-if="dashboard.totalReviews" class="muted"> ({{ dashboard.totalReviews }})</small>
        </span>
      </div>
    </div>

    <div v-if="dashboard" class="stat-grid" style="margin-top: 0.75rem">
      <div class="card stat-card">
        <span class="stat-label">Chờ xử lý</span>
        <span class="stat-value">{{ dashboard.orders.pending }}</span>
      </div>
      <div class="card stat-card">
        <span class="stat-label">Đang xử lý</span>
        <span class="stat-value">{{ dashboard.orders.processing }}</span>
      </div>
      <div class="card stat-card">
        <span class="stat-label">Đang giao</span>
        <span class="stat-value">{{ dashboard.orders.shipping }}</span>
      </div>
      <div class="card stat-card">
        <span class="stat-label">Đã giao</span>
        <span class="stat-value">{{ dashboard.orders.delivered }}</span>
      </div>
      <div class="card stat-card">
        <span class="stat-label">SP / Active</span>
        <span class="stat-value">
          {{ dashboard.products.totalProducts }} / {{ dashboard.products.activeProducts }}
        </span>
      </div>
      <div class="card stat-card">
        <span class="stat-label">Sắp hết / Hết hàng</span>
        <span class="stat-value">
          {{ dashboard.inventory.lowStockCount }} / {{ dashboard.inventory.outOfStockCount }}
        </span>
      </div>
    </div>

    <p v-if="dashboard?.ratingWarning" class="alert alert-error" style="margin-top: 1rem">
      {{ dashboard.ratingWarning }}
    </p>

    <div class="card" style="margin-top: 1rem">
      <h2>Doanh thu theo tháng</h2>
      <LineChart v-if="salesData.length" :data="salesData" label="Doanh thu (VND)" />
      <p v-else class="muted">Chưa có dữ liệu biểu đồ (cần đơn Đã giao có seller_id).</p>
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

    <div v-if="dashboard?.recentOrders.length" class="card" style="margin-top: 1rem">
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
            <tr v-for="o in dashboard.recentOrders" :key="o.orderId">
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
    </div>

    <div v-if="dashboard?.recentReviews.length" class="card" style="margin-top: 1rem">
      <h2>Đánh giá gần đây</h2>
      <ul class="review-list">
        <li v-for="r in dashboard.recentReviews" :key="r.id">
          <strong>{{ r.productName }}</strong> · {{ r.rating }}★
          <p class="muted">{{ r.comment }}</p>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 1rem;
  font-size: 1rem;
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
</style>
