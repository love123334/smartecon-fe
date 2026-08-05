<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import DemandTrendChart from '@/components/dss/DemandTrendChart.vue'
import { dssApi } from '@/api/services'
import type { DemandPredictionApi } from '@/api/real/dss'
import { useAuthStore } from '@/stores/auth'
import { loadSellerCatalogForDss } from '@/utils/sellerCatalog'
import {
  FORECAST_PERIOD_OPTIONS,
  HISTORICAL_DAYS_OPTIONS,
  buildDemandPredictionAiInsight,
  buildFlatForecastSeries,
  formatViDateTime,
  formatViNumber,
  mapDemandPredictionError,
  validateDemandPredictionForm,
} from '@/utils/demandPrediction'

interface SellerProductOption {
  id: number
  name: string
}

interface SeriesPoint {
  day: number
  qty: number
}

const auth = useAuthStore()

const products = ref<SellerProductOption[]>([])
const productsLoading = ref(false)
const productsError = ref('')

const productId = ref<number | ''>('')
const historicalDays = ref<number>(90)
const forecastPeriod = ref<number>(30)

const fieldErrors = ref<{ productId?: string; historicalDays?: string; forecastPeriod?: string }>({})
const submitting = ref(false)
const submitError = ref('')
const successMessage = ref('')
const result = ref<DemandPredictionApi | null>(null)
const historicalSeries = ref<SeriesPoint[]>([])
const forecastSeries = ref<SeriesPoint[]>([])
const chartFromApi = ref(false)

let requestSeq = 0

const selectedProduct = computed(() =>
  products.value.find((p) => p.id === productId.value) ?? null,
)

const displayProductName = computed(
  () =>
    (result.value?.productName && result.value.productName.trim()) ||
    selectedProduct.value?.name ||
    '—',
)

const canSubmit = computed(
  () => !submitting.value && !productsLoading.value && products.value.length > 0,
)

const aiInsight = computed(() => {
  if (!result.value) return null
  return buildDemandPredictionAiInsight({
    productName: displayProductName.value,
    historicalDays: result.value.historicalDays,
    forecastPeriod: result.value.forecastPeriod,
    averageDailyDemand: result.value.averageDailyDemand,
    predictedDemand: result.value.predictedDemand,
  })
})

const hasChart = computed(
  () => historicalSeries.value.length > 0 || forecastSeries.value.length > 0,
)

onMounted(async () => {
  await loadSellerProducts()
})

async function loadSellerProducts() {
  if (!auth.user) return
  productsLoading.value = true
  productsError.value = ''
  try {
    const sellerKey = auth.user.backendId ?? auth.user.id
    const { products: list, error } = await loadSellerCatalogForDss({
      sellerId: sellerKey,
      withStock: false,
    })
    if (error) {
      products.value = []
      productId.value = ''
      productsError.value = error
      return
    }
    products.value = list
      .map((p) => ({ id: Number(p.id), name: p.name }))
      .filter((p) => Number.isFinite(p.id) && p.id > 0)
    if (!products.value.length) {
      productsError.value = 'Bạn chưa có sản phẩm nào để tạo dự báo.'
      productId.value = ''
    } else if (!products.value.some((p) => p.id === productId.value)) {
      productId.value = products.value[0].id
    }
  } catch (e) {
    products.value = []
    productId.value = ''
    productsError.value = e instanceof Error ? e.message : 'Không tải được danh sách sản phẩm.'
  } finally {
    productsLoading.value = false
  }
}

function normalizeSeries(
  rows: { day: number; qty: number }[] | undefined,
): SeriesPoint[] {
  if (!rows?.length) return []
  return rows
    .map((r) => ({ day: Number(r.day), qty: Number(r.qty) }))
    .filter((r) => Number.isFinite(r.day) && Number.isFinite(r.qty))
}

async function loadChartSeries(payload: {
  productId: number
  historicalDays: number
  forecastPeriod: number
  averageDailyDemand: number
}) {
  chartFromApi.value = false
  historicalSeries.value = []
  forecastSeries.value = []
  try {
    const series = await dssApi.forecastDemand({
      productId: String(payload.productId),
      historyDays: payload.historicalDays,
      forecastDays: payload.forecastPeriod,
    })
    const hist = normalizeSeries(series.historicalSales)
    const fc = normalizeSeries(series.forecastSales)
    if (hist.length || fc.length) {
      historicalSeries.value = hist
      forecastSeries.value = fc
      chartFromApi.value = true
      return
    }
  } catch {
    /* fallback flat series below */
  }
  const start = payload.historicalDays + 1
  forecastSeries.value = buildFlatForecastSeries(
    payload.averageDailyDemand,
    Math.min(payload.forecastPeriod, 30),
    start,
  )
  historicalSeries.value = []
}

async function onSubmit() {
  if (submitting.value) return

  successMessage.value = ''
  submitError.value = ''
  fieldErrors.value = {}

  const validated = validateDemandPredictionForm({
    productId: productId.value,
    historicalDays: historicalDays.value,
    forecastPeriod: forecastPeriod.value,
  })

  if (!validated.ok) {
    fieldErrors.value = validated.errors
    return
  }

  const seq = ++requestSeq
  submitting.value = true
  try {
    const data = await dssApi.createDemandPrediction(validated.payload)
    if (seq !== requestSeq) return
    result.value = {
      ...data,
      productName:
        (data.productName && data.productName.trim()) ||
        selectedProduct.value?.name ||
        '',
    }
    successMessage.value = 'Tạo dự báo nhu cầu thành công.'
    await loadChartSeries({
      productId: validated.payload.productId,
      historicalDays: data.historicalDays,
      forecastPeriod: data.forecastPeriod,
      averageDailyDemand: data.averageDailyDemand,
    })
  } catch (e) {
    if (seq !== requestSeq) return
    submitError.value = mapDemandPredictionError(e)
  } finally {
    if (seq === requestSeq) submitting.value = false
  }
}

function resetResult() {
  requestSeq += 1
  submitting.value = false
  result.value = null
  successMessage.value = ''
  submitError.value = ''
  fieldErrors.value = {}
  historicalSeries.value = []
  forecastSeries.value = []
  chartFromApi.value = false
}
</script>

<template>
  <div class="dss-page demand-page">
    <header class="dss-page__header">
      <nav class="dss-crumb" aria-label="Breadcrumb">
        <RouterLink to="/seller/products">Bảng điều khiển người bán</RouterLink>
        <span>/</span>
        <RouterLink to="/seller/dss">DSS</RouterLink>
        <span>/</span>
        <span>Dự báo nhu cầu</span>
      </nav>
      <h1>Dự báo nhu cầu</h1>
      <p class="dss-page__sub">
        Moving Average từ lịch sử bán hàng — kèm biểu đồ xu hướng và nhận định AI để quyết định nhập hàng.
      </p>
    </header>

    <div class="demand-layout">
      <section class="dss-card demand-config" aria-labelledby="demand-config-title">
        <div class="demand-card-head">
          <h2 id="demand-config-title" class="dss-card__title">Cấu hình dự báo</h2>
          <span class="demand-pill">MA</span>
        </div>

        <p v-if="productsLoading" class="dss-hint" role="status">Đang tải sản phẩm…</p>
        <p v-else-if="productsError" class="dss-alert dss-alert--warn" role="alert">{{ productsError }}</p>

        <form class="dss-form" @submit.prevent="onSubmit">
          <div class="demand-form-stack">
            <label class="dss-field">
              <span id="product-label">Sản phẩm</span>
              <select
                v-model.number="productId"
                class="dss-input"
                :disabled="productsLoading || !products.length || submitting"
                aria-labelledby="product-label"
                aria-describedby="product-help product-error"
                :aria-invalid="Boolean(fieldErrors.productId)"
                required
              >
                <option disabled value="">— Chọn sản phẩm —</option>
                <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
              <small id="product-help" class="dss-hint">
                Chỉ sản phẩm thuộc tài khoản Seller hiện tại.
              </small>
              <small v-if="fieldErrors.productId" id="product-error" class="dss-field-error" role="alert">
                {{ fieldErrors.productId }}
              </small>
            </label>

            <div class="demand-form-row">
              <label class="dss-field">
                <span id="historical-label">Số ngày lịch sử</span>
                <select
                  v-model.number="historicalDays"
                  class="dss-input"
                  :disabled="submitting"
                  aria-labelledby="historical-label"
                  aria-describedby="historical-help historical-error"
                  :aria-invalid="Boolean(fieldErrors.historicalDays)"
                >
                  <option v-for="d in HISTORICAL_DAYS_OPTIONS" :key="d" :value="d">{{ d }} ngày</option>
                </select>
                <small id="historical-help" class="dss-hint">Cửa sổ dữ liệu bán hàng.</small>
                <small
                  v-if="fieldErrors.historicalDays"
                  id="historical-error"
                  class="dss-field-error"
                  role="alert"
                >
                  {{ fieldErrors.historicalDays }}
                </small>
              </label>

              <label class="dss-field">
                <span id="forecast-label">Kỳ dự báo</span>
                <select
                  v-model.number="forecastPeriod"
                  class="dss-input"
                  :disabled="submitting"
                  aria-labelledby="forecast-label"
                  aria-describedby="forecast-help forecast-error"
                  :aria-invalid="Boolean(fieldErrors.forecastPeriod)"
                >
                  <option v-for="d in FORECAST_PERIOD_OPTIONS" :key="d" :value="d">{{ d }} ngày</option>
                </select>
                <small id="forecast-help" class="dss-hint">Số ngày tương lai cần dự báo.</small>
                <small
                  v-if="fieldErrors.forecastPeriod"
                  id="forecast-error"
                  class="dss-field-error"
                  role="alert"
                >
                  {{ fieldErrors.forecastPeriod }}
                </small>
              </label>
            </div>
          </div>

          <div class="dss-actions">
            <button
              type="submit"
              class="dss-btn dss-btn--primary"
              :disabled="!canSubmit"
              :aria-busy="submitting"
            >
              {{ submitting ? 'Đang tạo dự báo…' : 'Tạo dự báo' }}
            </button>
            <button
              v-if="result"
              type="button"
              class="dss-btn dss-btn--outline"
              :disabled="submitting"
              @click="resetResult"
            >
              Làm mới
            </button>
          </div>
        </form>

        <div v-if="submitError" class="dss-alert dss-alert--warn" role="alert" style="margin-top: 1rem">
          {{ submitError }}
        </div>
        <div
          v-if="successMessage"
          class="dss-alert dss-alert--success"
          role="status"
          style="margin-top: 1rem"
        >
          {{ successMessage }}
        </div>
      </section>

      <section class="dss-card demand-result" aria-labelledby="demand-result-title">
        <div class="demand-card-head">
          <h2 id="demand-result-title" class="dss-card__title">Kết quả dự báo</h2>
          <span v-if="result" class="demand-pill demand-pill--soft">{{ formatViDateTime(result.generatedAt) }}</span>
        </div>

        <div v-if="!result" class="dss-empty demand-empty" role="status">
          <div class="dss-empty__art" aria-hidden="true">📈</div>
          <h2>Chưa có kết quả</h2>
          <p>Chọn sản phẩm, cấu hình lịch sử / kỳ dự báo rồi bấm “Tạo dự báo”.</p>
        </div>

        <template v-else>
          <div class="demand-hero">
            <div class="demand-hero__copy">
              <p class="demand-hero__product">{{ displayProductName }}</p>
              <p class="demand-hero__meta">
                Lịch sử {{ formatViNumber(result.historicalDays) }} ngày
                · Kỳ {{ formatViNumber(result.forecastPeriod) }} ngày
                · TB {{ formatViNumber(result.averageDailyDemand) }}/ngày
              </p>
            </div>
            <div class="demand-hero__stat" aria-label="Tổng nhu cầu dự báo">
              <span>Tổng nhu cầu dự báo</span>
              <strong>{{ formatViNumber(result.predictedDemand) }}</strong>
              <em>đơn vị</em>
            </div>
          </div>

          <div class="demand-kpi-strip" aria-label="Chỉ số tóm tắt">
            <article class="demand-kpi">
              <span>TB / ngày</span>
              <strong>{{ formatViNumber(result.averageDailyDemand) }}</strong>
            </article>
            <article class="demand-kpi">
              <span>Lịch sử</span>
              <strong>{{ formatViNumber(result.historicalDays) }} ngày</strong>
            </article>
            <article class="demand-kpi">
              <span>Kỳ dự báo</span>
              <strong>{{ formatViNumber(result.forecastPeriod) }} ngày</strong>
            </article>
            <article class="demand-kpi demand-kpi--accent">
              <span>Tổng dự báo</span>
              <strong>{{ formatViNumber(result.predictedDemand) }}</strong>
            </article>
          </div>
        </template>
      </section>
    </div>

    <template v-if="result && aiInsight">
      <section
        class="dss-card demand-ai"
        :class="`demand-ai--${aiInsight.tone}`"
        aria-labelledby="demand-ai-title"
      >
        <div class="demand-ai__head">
          <div>
            <span class="demand-ai__badge">{{ aiInsight.badge }}</span>
            <h2 id="demand-ai-title" class="dss-card__title">Nhận định AI</h2>
          </div>
          <p class="demand-ai__method">Dựa trên Moving Average · số liệu vừa tạo</p>
        </div>
        <h3 class="demand-ai__title">{{ aiInsight.title }}</h3>
        <p class="demand-ai__summary">{{ aiInsight.summary }}</p>
        <div class="demand-ai__cols">
          <div>
            <h4>Kế hoạch đề xuất</h4>
            <ol>
              <li v-for="(a, i) in aiInsight.actions" :key="i">{{ a }}</li>
            </ol>
          </div>
          <div>
            <h4>Rủi ro cần theo dõi</h4>
            <ul>
              <li v-for="(r, i) in aiInsight.risks" :key="i">{{ r }}</li>
            </ul>
          </div>
        </div>
        <div class="demand-ai__links">
          <RouterLink class="dss-btn dss-btn--outline" to="/seller/dss/inventory">Khuyến nghị tồn</RouterLink>
          <RouterLink class="dss-btn dss-btn--outline" to="/seller/dss/price">Gợi ý giá</RouterLink>
          <RouterLink class="dss-btn dss-btn--outline" to="/seller/dss/what-if">What-if</RouterLink>
        </div>
      </section>

      <section v-if="hasChart" class="dss-card" aria-labelledby="demand-chart-title">
        <div class="demand-card-head">
          <h2 id="demand-chart-title" class="dss-card__title">Xu hướng nhu cầu</h2>
          <span class="demand-pill demand-pill--soft">
            {{ chartFromApi ? 'Từ lịch sử bán hàng' : 'Minh họa từ TB/ngày' }}
          </span>
        </div>
        <DemandTrendChart :historical="historicalSeries" :forecast="forecastSeries" />
      </section>
    </template>
  </div>
</template>

<style scoped>
.demand-page {
  max-width: 1180px;
}

.demand-layout {
  display: grid;
  grid-template-columns: minmax(280px, 0.95fr) minmax(320px, 1.15fr);
  gap: 1rem;
  margin-bottom: 1rem;
  align-items: start;
}

.demand-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
}

.demand-card-head .dss-card__title {
  margin-bottom: 0;
}

.demand-pill {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  height: 1.6rem;
  padding: 0 0.65rem;
  border-radius: 999px;
  background: #e3f2fd;
  color: #1565c0;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.demand-pill--soft {
  background: #f5f7fb;
  color: #607d8b;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 600;
}

.demand-form-stack {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  margin-bottom: 1rem;
}

.demand-form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;
}

.dss-hint {
  display: block;
  margin-top: 0.35rem;
  color: var(--dss-muted, #607d8b);
  font-size: 0.8125rem;
  line-height: 1.4;
}

.dss-field-error {
  display: block;
  margin-top: 0.35rem;
  color: #c62828;
  font-size: 0.8125rem;
}

.dss-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
}

.demand-empty {
  padding: 2.5rem 1rem;
}

.demand-hero {
  display: grid;
  grid-template-columns: 1.2fr 0.9fr;
  gap: 1rem;
  align-items: stretch;
  margin-top: 0.5rem;
}

.demand-hero__copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.35rem 0;
}

.demand-hero__product {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: #0d47a1;
  line-height: 1.35;
}

.demand-hero__meta {
  margin: 0;
  color: #607d8b;
  font-size: 0.875rem;
  line-height: 1.45;
}

.demand-hero__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 1.25rem 1rem;
  border-radius: 14px;
  background: linear-gradient(160deg, #e3f2fd 0%, #bbdefb 100%);
  border: 1px solid #90caf9;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
}

.demand-hero__stat span {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #1565c0;
}

.demand-hero__stat strong {
  margin: 0.2rem 0;
  font-size: clamp(2.1rem, 4vw, 2.85rem);
  line-height: 1.05;
  color: #0d47a1;
}

.demand-hero__stat em {
  font-style: normal;
  font-weight: 650;
  color: #546e7a;
  font-size: 0.875rem;
}

.demand-kpi-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem;
  margin-top: 1rem;
}

.demand-kpi {
  padding: 0.85rem 0.9rem;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e3e8ef;
}

.demand-kpi span {
  display: block;
  margin-bottom: 0.3rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #607d8b;
}

.demand-kpi strong {
  font-size: 1.05rem;
  color: #0d47a1;
}

.demand-kpi--accent {
  background: linear-gradient(180deg, #e3f2fd, #fff);
  border-color: #90caf9;
}

.demand-ai {
  border-left: 4px solid #2e7d32;
  background: linear-gradient(180deg, #f1f8f4 0%, #fff 42%);
}

.demand-ai--strong {
  border-left-color: #1565c0;
  background: linear-gradient(180deg, #e8f1fb 0%, #fff 42%);
}

.demand-ai--steady {
  border-left-color: #2e7d32;
}

.demand-ai--soft {
  border-left-color: #ef6c00;
  background: linear-gradient(180deg, #fff8e1 0%, #fff 42%);
}

.demand-ai--sparse {
  border-left-color: #90a4ae;
  background: linear-gradient(180deg, #eceff1 0%, #fff 42%);
}

.demand-ai__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  margin-bottom: 0.35rem;
}

.demand-ai__badge {
  display: inline-flex;
  margin-bottom: 0.45rem;
  padding: 0.28rem 0.65rem;
  border-radius: 999px;
  background: #1b5e20;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.demand-ai--strong .demand-ai__badge {
  background: #0d47a1;
}

.demand-ai--soft .demand-ai__badge {
  background: #e65100;
}

.demand-ai--sparse .demand-ai__badge {
  background: #546e7a;
}

.demand-ai__method {
  margin: 0;
  font-size: 0.8125rem;
  color: #607d8b;
}

.demand-ai__title {
  margin: 0 0 0.55rem;
  font-size: 1.15rem;
  color: #0d47a1;
}

.demand-ai__summary {
  margin: 0 0 1.1rem;
  max-width: 78ch;
  line-height: 1.6;
  color: #37474f;
}

.demand-ai__cols {
  display: grid;
  grid-template-columns: 1.15fr 0.95fr;
  gap: 1rem 1.5rem;
}

.demand-ai__cols h4 {
  margin: 0 0 0.45rem;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #546e7a;
}

.demand-ai__cols ol,
.demand-ai__cols ul {
  margin: 0;
  padding-left: 1.15rem;
  color: #37474f;
  line-height: 1.55;
}

.demand-ai__cols li + li {
  margin-top: 0.35rem;
}

.demand-ai__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 1.15rem;
}

.dss-input:focus-visible,
.dss-btn:focus-visible {
  outline: 2px solid #1976d2;
  outline-offset: 2px;
}

@media (max-width: 960px) {
  .demand-layout,
  .demand-hero,
  .demand-ai__cols {
    grid-template-columns: 1fr;
  }

  .demand-kpi-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .demand-form-row {
    grid-template-columns: 1fr;
  }
}
</style>
