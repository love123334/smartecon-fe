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
const saving = ref(false)
const error = ref('')
const savedMessage = ref('')
const result = ref<DemandForecastApi | null>(null)

const historyOptions = [7, 14, 30, 60, 180]
const forecastOptions = [7, 14, 30]
const selectedProduct = computed(() => products.value.find((p) => p.id === productId.value))
const features = computed(() => result.value?.featureSnapshot)
const modelState = computed(() => ({
  label: 'Mô hình LightGBM real time cải tiến',
  tone: 'success',
}))
const trendLabel = computed(() => {
  const slope = Number(features.value?.trendSlope ?? 0)
  if (slope >= 0.02) return 'Đang tăng'
  if (slope <= -0.02) return 'Đang giảm'
  return 'Tương đối ổn định'
})
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
  savedMessage.value = ''
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

async function saveForecast() {
  if (!productId.value || !result.value || saving.value) return
  saving.value = true
  error.value = ''
  savedMessage.value = ''
  try {
    await dssApi.createDemandPrediction({
      productId: Number(productId.value),
      historicalDays: historyDays.value,
      forecastPeriod: forecastDays.value,
    })
    savedMessage.value = 'Đã lưu kết quả dự báo thành công.'
  } catch (e) {
    error.value = mapDemandPredictionError(e)
  } finally {
    saving.value = false
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
        <div><h2 class="dss-card__title">Cấu hình lần chạy</h2><p>Chạy để xem trước; lưu kết quả khi bạn hài lòng với dự báo.</p></div>
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
    <div v-if="savedMessage" class="dss-alert dss-alert--success" role="status">{{ savedMessage }}</div>

    <template v-if="result && !running">
      <section class="metric-grid">
        <article><span>Tổng dự báo</span><strong>{{ formatViNumber(result.predictedDemand) }}</strong><small>đơn vị / {{ result.forecastDays }} ngày</small></article>
        <article><span>TB dự báo/ngày</span><strong>{{ formatViNumber(features?.forecastAverageDailyDemand ?? result.predictedDemand / result.forecastDays) }}</strong><small>đơn vị</small></article>
        <article><span>Xu hướng</span><strong>{{ trendLabel }}</strong><small>độ dốc {{ formatViNumber(features?.trendSlope) }}</small></article>
        <article><span>Ngày có bán</span><strong>{{ formatViNumber(features?.positiveDays) }}</strong><small>/ {{ result.historicalDays }} ngày</small></article>
      </section>

      <section class="dss-card chart-card">
        <div class="section-head"><div><h2 class="dss-card__title">Lịch sử và đường dự báo</h2><p>{{ result.productName || selectedProduct?.name }} · tạo lúc {{ formatViDateTime(result.generatedAt) }}</p></div><span v-if="result.insufficientData" class="data-warning">Thiếu dữ liệu</span></div>
        <LightGbmForecastChart :historical="historicalSeries" :forecast="forecastSeries" />
      </section>

      <section class="detail-grid">
        <article class="dss-card">
          <h2 class="dss-card__title">Chỉ số đầu vào đã dùng</h2>
          <dl class="feature-list">
            <div><dt>Nhu cầu gần đây</dt><dd>{{ formatViNumber(features?.recentAverageDailyDemand) }}</dd></div>
            <div><dt>Nhu cầu trung hạn</dt><dd>{{ formatViNumber(features?.mediumAverageDailyDemand) }}</dd></div>
            <div><dt>Đà nhu cầu</dt><dd>{{ formatViNumber(features?.momentum) }}</dd></div>
            <div><dt>Cách đây 7 ngày</dt><dd>{{ formatViNumber(features?.lag7) }}</dd></div>
            <div><dt>Tín hiệu mùa vụ tuần</dt><dd>{{ formatViNumber(features?.seasonalSignal) }}</dd></div>
            <div><dt>Tồn kho hiện tại</dt><dd>{{ formatViNumber(features?.currentStock) }}</dd></div>
          </dl>
        </article>
        <article class="dss-card action-card">
          <h2 class="dss-card__title">Xác nhận kết quả</h2>
          <p>Biểu đồ trên là kết quả xem trước. Nếu hợp lý, lưu lần dự báo này để hệ thống ghi nhận.</p>
          <button class="dss-btn dss-btn--outline" :disabled="saving" @click="saveForecast">{{ saving ? 'Đang lưu…' : 'Lưu kết quả dự báo' }}</button>
        </article>
      </section>
    </template>
  </div>
</template>

<style scoped>
.lgbm-demo { max-width: 1180px; }
.demo-header,.section-head { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
.section-head { align-items:flex-start; margin-bottom:1rem; }
.section-head h2 { margin-bottom:.25rem; }
.section-head p,.action-card p { margin:0; color:#64748b; font-size:.88rem; line-height:1.55; }
.model-state { padding:.38rem .65rem; border-radius:999px; font-size:.78rem; font-weight:800; white-space:nowrap; }
.model-state--idle,.model-state--muted { background:#f1f5f9; color:#475569; }
.model-state--success { background:#dcfce7; color:#166534; }
.metric-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.8rem; margin-bottom:1rem; }
.metric-grid article { padding:1rem; border-radius:12px; border:1px solid #e2e8f0; background:#fff; box-shadow:var(--dss-shadow); }
.metric-grid span,.metric-grid small { display:block; color:#64748b; font-size:.78rem; }
.metric-grid strong { display:block; margin:.35rem 0; color:#0f3d78; font-size:1.35rem; }
.chart-card { padding-bottom:1rem; }
.data-warning { color:#b45309; background:#fef3c7; padding:.35rem .6rem; border-radius:999px; font-size:.8rem; font-weight:700; }
.detail-grid { display:grid; grid-template-columns:1.5fr 1fr; gap:1rem; }
.feature-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.65rem; margin:0; }
.feature-list div { display:flex; justify-content:space-between; gap:1rem; padding:.65rem .75rem; background:#f8fafc; border-radius:8px; }
.feature-list dt { color:#64748b; }.feature-list dd { margin:0; font-weight:750; color:#0f172a; }
.action-card { display:flex; flex-direction:column; align-items:flex-start; }.action-card .dss-btn { margin-top:auto; }
@media (max-width:800px) { .demo-header,.section-head { align-items:flex-start; flex-direction:column; }.metric-grid { grid-template-columns:repeat(2,1fr); }.detail-grid { grid-template-columns:1fr; } }
@media (max-width:520px) { .metric-grid,.feature-list { grid-template-columns:1fr; } }
</style>
