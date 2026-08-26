<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import LightGbmForecastChart from '@/components/dss/LightGbmForecastChart.vue'
import DssThinkingLoader from '@/components/dss/DssThinkingLoader.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import { dssApi } from '@/api/services'
import { clearApiCache } from '@/api/http/client'
import type { DemandForecastApi } from '@/api/real/dss'
import { useAuthStore } from '@/stores/auth'
import { loadSellerCatalogForDss } from '@/utils/sellerCatalog'
import { formatViDateTime, formatViNumber, mapDemandPredictionError } from '@/utils/demandPrediction'

interface ProductOption { id: number; name: string }

const auth = useAuthStore()
const products = ref<ProductOption[]>([])
const productId = ref<number | ''>('')
const historyDays = ref(30)
const forecastDays = ref(7)
const loadingProducts = ref(false)
const running = ref(false)
const error = ref('')
const result = ref<DemandForecastApi | null>(null)

const historyOptions = [7, 14, 30, 60, 180]
const forecastOptions = [7, 14, 30]
const selectedProduct = computed(() => products.value.find((p) => p.id === productId.value))
const features = computed(() => result.value?.featureSnapshot)
const METHOD_LABELS: Record<string, string> = {
  lightgbm_onnx: 'Mô hình LightGBM',
  lightgbm_onnx_with_baseline_fallback: 'Mô hình LightGBM',
  holt_linear: 'Holt Linear',
  holt_winters: 'Holt-Winters',
  moving_average: 'Trung bình động',
  croston_sba: 'Croston (nhu cầu thưa)',
}

const modelState = computed(() => {
  if (!result.value) {
    return { label: 'Sẵn sàng dự báo', tone: 'muted' as const }
  }
  if (features.value?.onnxModelUsed) {
    return { label: 'Mô hình LightGBM', tone: 'success' as const }
  }
  const method = String(result.value.method || features.value?.statisticalMethod || '')
  return {
    label: METHOD_LABELS[method] ?? 'Mô hình thống kê',
    tone: 'muted' as const,
  }
})
const trendLabel = computed(() => {
  const fromApi = features.value?.historyTrendLabel
  if (fromApi) return fromApi
  const slope = Number(features.value?.trendSlope ?? 0)
  if (slope >= 0.02) return 'Đang tăng'
  if (slope <= -0.02) return 'Đang giảm'
  return 'Tương đối ổn định'
})
const forecastTrendLabel = computed(() => {
  const fromApi = features.value?.forecastTrendLabel
  if (fromApi) return fromApi
  if (!forecastSeries.value.length) return 'Tương đối ổn định'
  const first = forecastSeries.value[0]?.qty ?? 0
  const last = forecastSeries.value[forecastSeries.value.length - 1]?.qty ?? first
  const days = Math.max(1, forecastSeries.value.length - 1)
  const slope = (last - first) / days
  if (slope >= 0.02) return 'Đang tăng'
  if (slope <= -0.02) return 'Đang giảm'
  return 'Tương đối ổn định'
})
const forecastTrendTone = computed(() => {
  const code = features.value?.forecastTrendDirection
  if (code === 'up') return 'up'
  if (code === 'down') return 'down'
  return 'stable'
})
const trendDivergenceReason = computed(() => {
  const reason = features.value?.trendDivergenceReason
  return typeof reason === 'string' && reason.trim() ? reason.trim() : ''
})
const daysWithSales = computed(() => {
  const fromApi = Number(features.value?.positiveDays)
  if (Number.isFinite(fromApi) && fromApi >= 0) return fromApi
  return historicalSeries.value.filter((p) => p.qty > 0).length
})
const avgDailyForecast = computed(() => {
  const fromApi = Number(features.value?.forecastAverageDailyDemand)
  if (Number.isFinite(fromApi)) return fromApi
  const total = Number(result.value?.predictedDemand)
  const days = Number(result.value?.forecastDays || forecastDays.value)
  if (!Number.isFinite(total) || !days) return 0
  return total / days
})
const historyWindowLabel = computed(() => `${result.value?.historicalDays ?? historyDays.value} ngày`)
const forecastWindowLabel = computed(() => `${result.value?.forecastDays ?? forecastDays.value} ngày`)
const recommendationProductName = computed(
  () => result.value?.productName || selectedProduct.value?.name || 'sản phẩm đã chọn',
)
const historicalSeries = computed(() =>
  (result.value?.historicalSales ?? [])
    .filter((p) => (p.date || p.day != null) && Number.isFinite(Number(p.qty)))
    .map((p) => ({
      date: p.date ?? String(p.day ?? ''),
      qty: Number(p.qty),
    })),
)
const forecastSeries = computed(() =>
  (result.value?.forecastSales ?? [])
    .filter((p) => (p.date || p.day != null) && Number.isFinite(Number(p.qty)))
    .map((p) => ({
      date: p.date ?? String(p.day ?? ''),
      qty: Number(p.qty),
    })),
)

onMounted(loadProducts)

async function loadProducts() {
  loadingProducts.value = true
  error.value = ''
  try {
    const sellerId = auth.user?.backendId ?? ''
    const loaded = await loadSellerCatalogForDss({
      sellerId,
      sellerEmail: auth.user?.email,
      withStock: false,
    })
    if (loaded.error && !loaded.products.length) throw new Error(loaded.error)
    products.value = loaded.products
      .map((p) => ({ id: Number(p.id), name: p.name }))
      .filter((p) => Number.isFinite(p.id) && p.id > 0)
      .sort((a, b) => Number(/dss forecast/i.test(b.name)) - Number(/dss forecast/i.test(a.name)))
    const growing = products.value.find((p) => /nhu cầu tăng/i.test(p.name))
    productId.value = growing?.id ?? products.value[0]?.id ?? ''
  } catch (e) {
    error.value = mapDemandPredictionError(e)
  } finally {
    loadingProducts.value = false
  }
}

async function runForecast() {
  if (!productId.value || running.value) return
  running.value = true
  error.value = ''
  clearApiCache('/dss')
  try {
    result.value = await dssApi.forecastDemand({
      productId: String(productId.value),
      historyDays: historyDays.value,
      forecastDays: forecastDays.value,
    })
  } catch (e) {
    result.value = null
    error.value = mapDemandPredictionError(e)
  } finally {
    running.value = false
  }
}
</script>

<template>
  <div class="dss-page lgbm-demo">
    <header class="dss-page__header demo-header">
      <div>
        <nav class="dss-crumb" aria-label="Breadcrumb">
          <RouterLink to="/seller/dss">DSS</RouterLink><span>/</span><span>Dự báo Nhu cầu</span>
        </nav>
        <h1>Dự báo Nhu cầu</h1>
        <p class="dss-page__sub">Xem nhu cầu quá khứ và dự báo số lượng bán cho từng sản phẩm.</p>
      </div>
    </header>

    <LoadingSpinner
      v-if="loadingProducts"
      page
      label="Đang tải danh sách sản phẩm DSS..."
      sublabel="Đang nạp dữ liệu tồn kho và lịch sử bán hàng từ hệ thống."
    />

    <section v-else class="dss-card config-card">
      <div class="section-head">
        <div><h2 class="dss-card__title">Cấu hình lần chạy</h2><p>Chọn sản phẩm và kỳ hạn, rồi chạy để xem dự báo.</p></div>
        <span :class="['model-state', `model-state--${modelState.tone}`]">{{ modelState.label }}</span>
      </div>

      <div class="dss-form-grid">
        <label class="dss-field">Sản phẩm
          <select v-model="productId" class="dss-input" :disabled="loadingProducts">
            <option value="" disabled>{{ loadingProducts ? 'Đang tải…' : 'Chọn sản phẩm' }}</option>
            <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <label class="dss-field">Dữ liệu quá khứ
          <select v-model="historyDays" class="dss-input"><option v-for="d in historyOptions" :key="d" :value="d">{{ d }} ngày</option></select>
        </label>
        <label class="dss-field">Khoảng dự báo
          <select v-model="forecastDays" class="dss-input"><option v-for="d in forecastOptions" :key="d" :value="d">{{ d }} ngày</option></select>
        </label>
      </div>
      <button class="dss-btn dss-btn--primary" :disabled="!productId || running" @click="runForecast">{{ running ? 'Đang dự báo…' : 'Chạy dự báo' }}</button>
    </section>

    <DssThinkingLoader
      v-if="running"
      title="Đang tính toán dự báo"
      detail="Máy đang đọc lịch sử bán, ước lượng xu hướng và chạy mô hình nhu cầu."
      :cards="2"
    />

    <div v-if="error" class="dss-alert dss-alert--warn" role="alert">{{ error }}</div>

    <template v-if="result && !running">
      <section class="metric-grid">
        <article><span>Tổng dự báo</span><strong>{{ formatViNumber(result.predictedDemand) }}</strong><small>đơn vị / {{ result.forecastDays }} ngày</small></article>
        <article><span>TB dự báo/ngày</span><strong>{{ formatViNumber(features?.forecastAverageDailyDemand ?? result.predictedDemand / result.forecastDays) }}</strong><small>đơn vị</small></article>
        <article><span>Xu hướng lịch sử</span><strong>{{ trendLabel }}</strong><small>độ dốc {{ formatViNumber(features?.trendSlope) }}</small></article>
        <article><span>Ngày có bán</span><strong>{{ formatViNumber(features?.positiveDays) }}</strong><small>/ {{ result.historicalDays }} ngày</small></article>
      </section>

      <section class="dss-card chart-card">
        <div class="section-head"><div><h2 class="dss-card__title">Lịch sử và đường dự báo</h2><p>{{ result.productName || selectedProduct?.name }} · tạo lúc {{ formatViDateTime(result.generatedAt) }}</p></div><span v-if="result.insufficientData" class="data-warning">Thiếu dữ liệu</span></div>
        <LightGbmForecastChart :historical="historicalSeries" :forecast="forecastSeries" />
        <aside class="forecast-trend" :data-tone="forecastTrendTone">
          <div class="forecast-trend__head">
            <h3>Xu hướng theo dự báo</h3>
            <strong>{{ forecastTrendLabel }}</strong>
          </div>
          <p class="forecast-trend__meta">
            độ dốc {{ formatViNumber(features?.forecastTrendSlope) }}
            · {{ forecastWindowLabel }} tới
          </p>
          <p v-if="trendDivergenceReason" class="forecast-trend__reason">{{ trendDivergenceReason }}</p>
        </aside>
      </section>

      <section class="dss-card recommend-card" aria-labelledby="system-recommend-title">
        <h2 id="system-recommend-title" class="dss-card__title">Khuyến nghị từ hệ thống</h2>
        <p>
          Khuyến nghị cho sản phẩm <strong>{{ recommendationProductName }}</strong>:
          Dữ liệu ghi nhận <strong>{{ formatViNumber(daysWithSales) }}</strong> ngày có bán hàng trong
          <strong>{{ historyWindowLabel }}</strong>.
          Dự báo <strong>{{ forecastWindowLabel }}</strong> đạt
          <strong>{{ formatViNumber(result.predictedDemand) }}</strong> sản phẩm
          (~<strong>{{ formatViNumber(avgDailyForecast) }}</strong> sản phẩm/ngày).
        </p>
        <p>Dự báo sản phẩm có xu hướng <strong>{{ forecastTrendLabel.toLowerCase() }}</strong>.</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.lgbm-demo { max-width: 1180px; }
.demo-header,.section-head { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
.section-head { align-items:flex-start; margin-bottom:1rem; }
.section-head h2 { margin-bottom:.25rem; }
.section-head p { margin:0; color:#64748b; font-size:.88rem; line-height:1.55; }
.model-state { padding:.38rem .65rem; border-radius:999px; font-size:.78rem; font-weight:800; white-space:nowrap; }
.model-state--idle,.model-state--muted { background:#f1f5f9; color:#475569; }
.model-state--success { background:#dcfce7; color:#166534; }
.metric-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.8rem; margin-bottom:1rem; }
.metric-grid article { padding:1rem; border-radius:12px; border:1px solid #e2e8f0; background:#fff; box-shadow:var(--dss-shadow); }
.metric-grid span,.metric-grid small { display:block; color:#64748b; font-size:.78rem; }
.metric-grid strong { display:block; margin:.35rem 0; color:#0f3d78; font-size:1.35rem; }
.chart-card { padding-bottom:1rem; }
.forecast-trend { margin-top:1rem; padding:1rem 1.1rem; border-radius:12px; border:1px solid #e2e8f0; background:#f8fafc; }
.forecast-trend__head { display:flex; align-items:baseline; justify-content:space-between; gap:.75rem; }
.forecast-trend h3 { margin:0; font-size:.95rem; color:#334155; }
.forecast-trend strong { font-size:1.15rem; color:#0f3d78; }
.forecast-trend[data-tone="up"] strong { color:#166534; }
.forecast-trend[data-tone="down"] strong { color:#b45309; }
.forecast-trend__meta { margin:.35rem 0 0; color:#64748b; font-size:.82rem; }
.forecast-trend__reason { margin:.7rem 0 0; color:#334155; font-size:.92rem; line-height:1.6; }
.data-warning { color:#b45309; background:#fef3c7; padding:.35rem .6rem; border-radius:999px; font-size:.8rem; font-weight:700; }
.recommend-card { margin-top:1rem; }
.recommend-card p { margin:0 0 .75rem; color:#334155; font-size:.95rem; line-height:1.65; }
.recommend-card p:last-child { margin-bottom:0; }
.recommend-card strong { color:#0f3d78; }
@media (max-width:800px) { .demo-header,.section-head { align-items:flex-start; flex-direction:column; }.metric-grid { grid-template-columns:repeat(2,1fr); } }
@media (max-width:520px) { .metric-grid { grid-template-columns:1fr; } }
</style>
