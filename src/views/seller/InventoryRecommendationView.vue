<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import InventoryStockBarChart from '@/components/dss/InventoryStockBarChart.vue'
import InventorySalesTrendChart from '@/components/dss/InventorySalesTrendChart.vue'
import {
  INVENTORY_ERROR_MESSAGES,
  INVENTORY_PRODUCTS,
  PLANNING_PERIOD_OPTIONS,
  generateInventoryRecommendation,
  type InventoryErrorCode,
  type InventoryRecommendationResult,
  type PlanningPeriodKey,
} from '@/utils/dssInventoryMock'

const productQuery = ref('')
const productId = ref('all')
const planningKey = ref<PlanningPeriodKey>('14')

const loading = ref(false)
const success = ref(false)
const errorCode = ref<InventoryErrorCode | null>(null)
const result = ref<InventoryRecommendationResult | null>(null)

const filteredProducts = computed(() => {
  const q = productQuery.value.trim().toLowerCase()
  if (!q) return INVENTORY_PRODUCTS
  return INVENTORY_PRODUCTS.filter((p) => p.name.toLowerCase().includes(q))
})

const trendSeries = computed(() => result.value?.rows[0]?.historicalSales ?? [])

async function generate() {
  success.value = false
  errorCode.value = null
  result.value = null
  loading.value = true

  await new Promise((r) => setTimeout(r, 700))

  const out = generateInventoryRecommendation({
    productId: productId.value,
    planningKey: planningKey.value,
  })

  loading.value = false

  if (!out.ok) {
    errorCode.value = out.error
    return
  }

  result.value = out.data
  success.value = true
}

function clearError() {
  errorCode.value = null
}
</script>

<template>
  <div class="dss-page">
    <header class="dss-page__header">
      <nav class="dss-crumb">
        <RouterLink to="/seller/products">Bảng điều khiển người bán</RouterLink>
        <span>/</span>
        <RouterLink to="/seller/dss">DSS</RouterLink>
        <span>/</span>
        <span>Khuyến nghị tồn kho</span>
      </nav>
      <h1>Khuyến nghị tồn kho</h1>
      <p class="dss-page__sub">
        Tạo khuyến nghị bổ sung hàng dựa trên doanh số lịch sử và tồn kho hiện tại (điểm đặt hàng lại /
        ROP).
      </p>
    </header>

    <!-- Lỗi -->
    <section v-if="errorCode" class="dss-warn-card">
      <div class="dss-warn-card__icon" aria-hidden="true">⚠</div>
      <h2>{{ INVENTORY_ERROR_MESSAGES[errorCode] }}</h2>
      <p>Vui lòng chọn sản phẩm khác hoặc kỳ hoạch định phù hợp rồi thử lại.</p>
      <button type="button" class="dss-btn dss-btn--outline" @click="clearError">Quay lại</button>
    </section>

    <template v-else>
      <!-- Bộ lọc -->
      <section class="dss-card">
        <h2 class="dss-card__title">Bộ lọc khuyến nghị</h2>
        <div class="dss-form-grid">
          <label class="dss-field">
            <span>Sản phẩm</span>
            <input
              v-model="productQuery"
              type="search"
              class="dss-input"
              placeholder="Tìm sản phẩm…"
            />
            <select v-model="productId" class="dss-input">
              <option v-for="p in filteredProducts" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </label>
          <label class="dss-field">
            <span>Kỳ hoạch định</span>
            <select v-model="planningKey" class="dss-input">
              <option v-for="o in PLANNING_PERIOD_OPTIONS" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </select>
          </label>
          <div class="dss-field dss-field--action">
            <span>&nbsp;</span>
            <button
              type="button"
              class="dss-btn dss-btn--primary"
              :disabled="loading"
              @click="generate"
            >
              {{ loading ? 'Đang tạo…' : 'Tạo khuyến nghị' }}
            </button>
          </div>
        </div>
      </section>

      <div v-if="success" class="dss-alert dss-alert--success" role="status">
        Tạo khuyến nghị tồn kho thành công.
      </div>

      <!-- Loading skeleton -->
      <template v-if="loading">
        <section class="dss-kpi-grid">
          <div v-for="n in 4" :key="n" class="dss-skel dss-skel--kpi" />
        </section>
        <div class="dss-skel dss-skel--panel" />
        <div class="dss-skel dss-skel--table" />
        <div class="dss-two-col">
          <div class="dss-skel dss-skel--chart" />
          <div class="dss-skel dss-skel--chart" />
        </div>
      </template>

      <!-- Empty -->
      <section v-else-if="!result" class="dss-empty">
        <div class="dss-empty__art" aria-hidden="true">📦</div>
        <h2>Chưa có khuyến nghị tồn kho</h2>
        <p>Chọn sản phẩm và kỳ hoạch định, rồi nhấn <strong>Tạo khuyến nghị</strong>.</p>
      </section>

      <template v-else>
        <!-- KPI -->
        <section class="dss-kpi-grid">
          <article class="dss-kpi">
            <span class="dss-kpi__icon" aria-hidden="true">📦</span>
            <span class="dss-kpi__label">Tồn kho hiện tại</span>
            <strong>{{ result.currentStock }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__icon" aria-hidden="true">📈</span>
            <span class="dss-kpi__label">Nhu cầu TB / ngày</span>
            <strong>{{ result.averageDailyDemand }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__icon" aria-hidden="true">🎯</span>
            <span class="dss-kpi__label">Điểm đặt hàng lại</span>
            <strong>{{ result.reorderPoint }}</strong>
          </article>
          <article class="dss-kpi dss-kpi--accent">
            <span class="dss-kpi__icon" aria-hidden="true">🛒</span>
            <span class="dss-kpi__label">SL đề xuất nhập</span>
            <strong>{{ result.recommendedOrderQuantity }}</strong>
          </article>
        </section>

        <!-- Trạng thái -->
        <section class="dss-card dss-status-panel" :class="`dss-status-panel--${result.overallStatus}`">
          <h2 class="dss-card__title">Trạng thái khuyến nghị</h2>
          <span
            class="dss-badge"
            :class="result.overallStatus === 'need' ? 'dss-badge--danger' : 'dss-badge--success'"
          >
            {{ result.overallStatusLabel }}
          </span>
          <p class="dss-status-panel__msg">{{ result.recommendationMessage }}</p>
          <p class="dss-hint">
            Sản phẩm trọng tâm: {{ result.focusProductName }} · Kỳ: {{ result.planningLabel }} · Tạo lúc
            {{ result.generatedAt }}
          </p>
        </section>

        <!-- Bảng -->
        <section class="dss-card">
          <h2 class="dss-card__title">Bảng khuyến nghị chi tiết</h2>
          <div class="dss-table-wrap">
            <table class="dss-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Tồn hiện tại</th>
                  <th>Nhu cầu TB/ngày</th>
                  <th>Lead time</th>
                  <th>Safety stock</th>
                  <th>ROP</th>
                  <th>SL đề xuất</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in result.rows" :key="row.productId">
                  <td>{{ row.productName }}</td>
                  <td>{{ row.currentStock }}</td>
                  <td>{{ row.averageDailyDemand }}</td>
                  <td>{{ row.leadTimeDays }} ngày</td>
                  <td>{{ row.safetyStock }}</td>
                  <td>{{ row.reorderPoint }}</td>
                  <td>{{ row.recommendedOrder }}</td>
                  <td>
                    <span
                      class="dss-badge"
                      :class="row.status === 'need' ? 'dss-badge--danger' : 'dss-badge--success'"
                    >
                      {{ row.statusLabel }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Biểu đồ -->
        <div class="dss-two-col">
          <section class="dss-card">
            <h2 class="dss-card__title">So sánh tồn kho · ROP · SL nhập</h2>
            <InventoryStockBarChart :rows="result.rows" />
          </section>
          <section class="dss-card">
            <h2 class="dss-card__title">Xu hướng bán hàng lịch sử</h2>
            <p class="dss-hint">Dùng để tính nhu cầu trung bình mỗi ngày (ADD).</p>
            <InventorySalesTrendChart
              :series="trendSeries"
              :product-name="result.rows[0]?.productName"
            />
          </section>
        </div>
      </template>
    </template>
  </div>
</template>
