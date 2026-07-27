<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import DemandTrendChart from '@/components/dss/DemandTrendChart.vue'
import {
  DEMAND_PRODUCTS,
  FORECAST_PERIOD_OPTIONS,
  HISTORICAL_WINDOW_OPTIONS,
  generateDemandForecast,
  type DemandForecastResult,
  type ForecastPeriodKey,
  type HistoricalWindowKey,
} from '@/utils/dssDemandMock'

const productQuery = ref('')
const productId = ref(DEMAND_PRODUCTS[0]?.id ?? '')
const forecastKey = ref<ForecastPeriodKey>('30')
const historicalKey = ref<HistoricalWindowKey>('90')

const success = ref(false)
const insufficient = ref(false)
const result = ref<DemandForecastResult | null>(null)

const filteredProducts = computed(() => {
  const q = productQuery.value.trim().toLowerCase()
  if (!q) return DEMAND_PRODUCTS
  return DEMAND_PRODUCTS.filter((p) => p.name.toLowerCase().includes(q))
})

const selectedProduct = computed(
  () => DEMAND_PRODUCTS.find((p) => p.id === productId.value) ?? DEMAND_PRODUCTS[0],
)

function generate() {
  success.value = false
  insufficient.value = false
  const product = selectedProduct.value
  if (!product) return

  const out = generateDemandForecast({
    productId: product.id,
    productName: product.name,
    forecastKey: forecastKey.value,
    historicalKey: historicalKey.value,
  })

  if (!out) {
    result.value = null
    insufficient.value = true
    return
  }

  result.value = out
  success.value = true
}

function backFromError() {
  insufficient.value = false
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
        <span>Dự báo nhu cầu</span>
      </nav>
      <h1>Dự báo nhu cầu</h1>
      <p class="dss-page__sub">
        Dự báo nhu cầu sản phẩm dựa trên doanh số lịch sử bằng phương pháp Moving Average.
      </p>
    </header>

    <section v-if="insufficient" class="dss-warn-card">
      <div class="dss-warn-card__icon" aria-hidden="true">⚠</div>
      <h2>Không đủ dữ liệu để tạo dự báo.</h2>
      <p>Cửa sổ lịch sử quá dài hoặc sản phẩm chưa có đủ đơn hàng mẫu. Hãy chọn cửa sổ ngắn hơn.</p>
      <button type="button" class="dss-btn dss-btn--outline" @click="backFromError">Quay lại</button>
    </section>

    <template v-else>
      <section class="dss-card">
        <h2 class="dss-card__title">Cấu hình dự báo</h2>
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
            <span>Kỳ dự báo</span>
            <select v-model="forecastKey" class="dss-input">
              <option v-for="o in FORECAST_PERIOD_OPTIONS" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </select>
          </label>
          <label class="dss-field">
            <span>Dữ liệu lịch sử</span>
            <select v-model="historicalKey" class="dss-input">
              <option v-for="o in HISTORICAL_WINDOW_OPTIONS" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </select>
          </label>
        </div>
        <button type="button" class="dss-btn dss-btn--primary" @click="generate">
          Tạo dự báo
        </button>
      </section>

      <div v-if="success" class="dss-alert dss-alert--success" role="status">
        Tạo dự báo nhu cầu thành công.
      </div>

      <template v-if="result">
        <section class="dss-kpi-grid">
          <article class="dss-kpi">
            <span class="dss-kpi__label">Nhu cầu TB / ngày</span>
            <strong>{{ result.averageDailyDemand }} đơn vị</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Nhu cầu dự báo</span>
            <strong>{{ result.predictedDemand }} đơn vị</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Số ngày lịch sử</span>
            <strong>{{ result.historicalDays }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Số ngày dự báo</span>
            <strong>{{ result.forecastDays }}</strong>
          </article>
        </section>

        <section class="dss-card">
          <h2 class="dss-card__title">Kết quả dự báo</h2>
          <div class="dss-result-grid">
            <div>
              <p class="dss-meta"><span>Tên sản phẩm</span>{{ result.productName }}</p>
              <p class="dss-meta"><span>Cửa sổ lịch sử</span>{{ result.historicalWindowLabel }}</p>
              <p class="dss-meta"><span>Kỳ dự báo</span>{{ result.forecastPeriodLabel }}</p>
              <p class="dss-meta"><span>Nhu cầu TB / ngày</span>{{ result.averageDailyDemand }} đơn vị</p>
              <p class="dss-meta"><span>Thời điểm tạo</span>{{ result.generatedAt }}</p>
            </div>
            <div class="dss-highlight">
              <span>Nhu cầu dự báo</span>
              <strong>{{ result.predictedDemand }}</strong>
              <em>đơn vị</em>
            </div>
          </div>
        </section>

        <section class="dss-card">
          <h2 class="dss-card__title">Biểu đồ xu hướng nhu cầu</h2>
          <DemandTrendChart
            :historical="result.historicalSales"
            :forecast="result.forecastSales"
          />
        </section>
      </template>
    </template>
  </div>
</template>
