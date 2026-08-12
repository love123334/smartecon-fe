<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import ProductSalesHistoryChart from '@/components/dss/ProductSalesHistoryChart.vue'
import DssPredictionContextPanel from '@/components/dss/DssPredictionContextPanel.vue'
import { dssApi } from '@/api/services'
import type { DemandPredictionApi } from '@/api/real/dss'
import { useAuthStore } from '@/stores/auth'
import { loadSellerCatalogForDss } from '@/utils/sellerCatalog'
import {
  FORECAST_PERIOD_OPTIONS,
  HISTORICAL_DAYS_OPTIONS,
  buildDemandPredictionAiInsight,
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
  date?: string
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
const chartFromApi = ref(false)
const chartError = ref('')

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
  if (result.value.aiInsight?.summary) {
    return {
      source: 'backend' as const,
      backend: result.value.aiInsight,
    }
  }
  return {
    source: 'local' as const,
    local: buildDemandPredictionAiInsight({
      productName: displayProductName.value,
      historicalDays: result.value.historicalDays,
      forecastPeriod: result.value.forecastPeriod,
      averageDailyDemand: result.value.averageDailyDemand,
      predictedDemand: result.value.seasonalityAdjustedDemand ?? result.value.predictedDemand,
    }),
  }
})

const localAiInsight = computed(() =>
  aiInsight.value?.source === 'local' ? aiInsight.value.local : null,
)

const forecastSeriesForChart = computed(() => {
  const rows = result.value?.forecastSeries ?? []
  return rows.map((r, i) => ({
    day: i + 1,
    qty: Number(r.predictedQty),
    date: r.date,
  }))
})

const hasChart = computed(() => historicalSeries.value.length > 0)

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
  rows: { day: number; qty: number; date?: string }[] | undefined,
): SeriesPoint[] {
  if (!rows?.length) return []
  return rows
    .map((r) => ({
      day: Number(r.day),
      qty: Number(r.qty),
      date: r.date,
    }))
    .filter((r) => Number.isFinite(r.day) && Number.isFinite(r.qty))
}

async function loadChartSeries(payload: {
  productId: number
  historicalDays: number
}) {
  chartFromApi.value = false
  chartError.value = ''
  historicalSeries.value = []
  try {
    const series = await dssApi.forecastDemand({
      productId: String(payload.productId),
      historyDays: payload.historicalDays,
      forecastDays: 7,
    })
    const hist = normalizeSeries(series.historicalSales)
    if (hist.length) {
      historicalSeries.value = hist
      chartFromApi.value = true
      return
    }
    chartError.value = 'Chưa có lịch sử bán hàng cho sản phẩm trong khoảng ngày đã chọn.'
  } catch (e) {
    chartError.value =
      e instanceof Error
        ? e.message
        : 'Không tải được lịch sử bán hàng từ hệ thống.'
  }
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
  chartFromApi.value = false
  chartError.value = ''
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
        Hỗ trợ dự đoán nhu cầu mua sắm trong tương lai.
      </p>
    </header>

    <div class="demand-layout">
      <section class="dss-card demand-config" aria-labelledby="demand-config-title">
        <h2 id="demand-config-title" class="dss-card__title demand-config__title">Cấu hình dự báo</h2>

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
                <option disabled value="">Chọn sản phẩm</option>
                <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
              <small id="product-help" class="dss-hint">
                Danh sách sản phẩm cửa hàng của bạn
              </small>
              <small v-if="fieldErrors.productId" id="product-error" class="dss-field-error" role="alert">
                {{ fieldErrors.productId }}
              </small>
            </label>

            <div class="demand-form-row">
              <label class="dss-field">
                <span id="historical-label">Số ngày lịch sử (Quá khứ)</span>
                <select
                  v-model.number="historicalDays"
                  class="dss-input"
                  :disabled="submitting"
                  aria-labelledby="historical-label"
                  aria-describedby="historical-error"
                  :aria-invalid="Boolean(fieldErrors.historicalDays)"
                >
                  <option v-for="d in HISTORICAL_DAYS_OPTIONS" :key="d" :value="d">{{ d }} ngày</option>
                </select>
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
                <span id="forecast-label">Kỳ dự báo (Tương lai)</span>
                <select
                  v-model.number="forecastPeriod"
                  class="dss-input"
                  :disabled="submitting"
                  aria-labelledby="forecast-label"
                  aria-describedby="forecast-error"
                  :aria-invalid="Boolean(fieldErrors.forecastPeriod)"
                >
                  <option v-for="d in FORECAST_PERIOD_OPTIONS" :key="d" :value="d">{{ d }} ngày</option>
                </select>
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
              class="dss-btn dss-btn--outline demand-btn-compact"
              :disabled="submitting"
              @click="resetResult"
            >
              Làm mới
            </button>
          </div>
        </form>

        <div v-if="submitError" class="dss-alert dss-alert--warn demand-config-alert" role="alert">
          {{ submitError }}
        </div>
        <div v-if="successMessage" class="dss-alert dss-alert--success demand-config-alert" role="status">
          {{ successMessage }}
        </div>
      </section>

      <div class="demand-main" :class="{ 'demand-main--split': result && localAiInsight }">
        <section class="dss-card demand-result" aria-labelledby="demand-result-title">
          <h2 id="demand-result-title" class="dss-card__title">Kết quả dự báo</h2>

          <div v-if="!result" class="dss-empty demand-empty" role="status">
            <div class="dss-empty__art" aria-hidden="true">📈</div>
            <h2>Chưa có kết quả</h2>
            <p>
              Hãy chọn sản phẩm cần dự báo, Số ngày lịch sử và Kỳ dự báo rồi chọn “Tạo dự báo”.
            </p>
          </div>

          <div v-else class="demand-result-body">
            <p class="demand-result__time">
              <span>Thời gian dự báo</span>
              <strong>{{ formatViDateTime(result.generatedAt) }}</strong>
            </p>
            <p class="demand-result__product">{{ displayProductName }}</p>

            <div class="demand-mini-kpis" aria-label="Chỉ số tóm tắt">
              <article class="demand-mini-kpi">
                <span>Lịch sử</span>
                <strong>{{ formatViNumber(result.historicalDays) }} ngày</strong>
              </article>
              <article class="demand-mini-kpi">
                <span>Kỳ dự báo</span>
                <strong>{{ formatViNumber(result.forecastPeriod) }} ngày</strong>
              </article>
              <article class="demand-mini-kpi">
                <span>TB / ngày</span>
                <strong>{{ formatViNumber(result.averageDailyDemand) }}</strong>
              </article>
            </div>

            <div class="demand-total-box" aria-label="Tổng nhu cầu dự báo">
              <span>Tổng nhu cầu (có mùa vụ & ngày lễ)</span>
              <strong>{{
                formatViNumber(result.seasonalityAdjustedDemand ?? result.predictedDemand)
              }}</strong>
              <em>sản phẩm</em>
            </div>
            <p v-if="result.methodology" class="dss-hint demand-methodology">{{ result.methodology }}</p>
            <p
              v-if="result.seasonalityAdjustedDemand && result.predictedDemand !== result.seasonalityAdjustedDemand"
              class="dss-hint"
            >
              Dự báo phẳng (không mùa vụ): {{ formatViNumber(result.predictedDemand) }} SP · Hệ số lễ
              ×{{ formatViNumber(result.holidayAdjustmentFactor ?? 1) }}
            </p>
          </div>
        </section>

        <section
          v-if="result && localAiInsight"
          class="dss-card demand-ai"
          :class="`demand-ai--${localAiInsight.tone}`"
          aria-labelledby="demand-ai-title"
        >
          <div class="demand-ai__head">
            <div>
              <span class="demand-ai__badge">{{ localAiInsight.badge }}</span>
              <h2 id="demand-ai-title" class="dss-card__title">Nhận định nhu cầu (tóm tắt)</h2>
            </div>
          </div>
          <h3 class="demand-ai__title">{{ localAiInsight.title }}</h3>
          <p class="demand-ai__summary">{{ localAiInsight.summary }}</p>
          <div class="demand-ai__cols">
            <div>
              <h4>Kế hoạch đề xuất</h4>
              <ol>
                <li v-for="(a, i) in localAiInsight.actions" :key="i">{{ a }}</li>
              </ol>
            </div>
            <div>
              <h4>Rủi ro cần theo dõi</h4>
              <ul>
                <li v-for="(r, i) in localAiInsight.risks" :key="i">{{ r }}</li>
              </ul>
            </div>
          </div>
          <div class="demand-ai__similar" aria-label="Tính năng tương tự">
            <span class="demand-ai__similar-label">Tính năng tương tự</span>
            <div class="demand-ai__similar-links">
              <RouterLink class="demand-ai__similar-link" to="/seller/dss/price">
                Gợi ý giá
              </RouterLink>
              <span class="demand-ai__similar-sep" aria-hidden="true">·</span>
              <RouterLink class="demand-ai__similar-link" to="/seller/dss/what-if">
                What-if
              </RouterLink>
            </div>
          </div>
        </section>
      </div>
    </div>

    <template v-if="result">
      <DssPredictionContextPanel
        :product-context="result.productContext"
        :upcoming-holidays="result.upcomingHolidays"
        :price-change-impacts="result.priceChangeImpacts"
        :ai-insight="result.aiInsight"
      />

      <section v-if="hasChart || forecastSeriesForChart.length" class="dss-card" aria-labelledby="demand-chart-title">
        <h2 id="demand-chart-title" class="dss-card__title">Lịch sử & dự báo theo ngày</h2>
        <p class="dss-hint demand-chart-note">
          Đường xanh: bán thực tế · Đường cam: dự báo có điều chỉnh mùa vụ / ngày lễ.
        </p>
        <ProductSalesHistoryChart
          :historical="historicalSeries"
          :forecast="forecastSeriesForChart"
        />
      </section>
      <p v-else-if="chartError" class="form-error demand-chart-note">{{ chartError }}</p>
    </template>
  </div>
</template>

<style scoped>
.demand-page {
  max-width: 1180px;
}

.demand-layout {
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: 0.85rem;
  margin-bottom: 1rem;
  align-items: stretch;
}

.demand-config {
  padding: 0.95rem 1rem;
  align-self: start;
}

.demand-config__title {
  margin-bottom: 0.65rem;
  font-size: 1rem;
}

.demand-config-alert {
  margin-top: 0.75rem;
}

.demand-main {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.85rem;
  min-width: 0;
}

.demand-main--split {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
}

.demand-main--split .demand-result,
.demand-main--split .demand-ai {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.demand-btn-compact {
  padding: 0.45rem 0.75rem;
  font-size: 0.8125rem;
}

.demand-result {
  display: flex;
  flex-direction: column;
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
  gap: 0.65rem;
  margin-bottom: 0.75rem;
}

.demand-form-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.65rem;
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
  padding: 2rem 0.75rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.demand-result-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
}

.demand-result__time {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.demand-result__time span {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #607d8b;
}

.demand-result__time strong {
  font-size: 0.875rem;
  font-weight: 600;
  color: #37474f;
}

.demand-result__product {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: #0d47a1;
  line-height: 1.35;
}

.demand-mini-kpis {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.demand-mini-kpi {
  padding: 0.65rem 0.55rem;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e3e8ef;
  text-align: center;
}

.demand-mini-kpi span {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #607d8b;
}

.demand-mini-kpi strong {
  font-size: 0.95rem;
  color: #0d47a1;
}

.demand-total-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 1rem 0.75rem;
  margin-top: auto;
  border-radius: 12px;
  background: linear-gradient(160deg, #e3f2fd 0%, #bbdefb 100%);
  border: 1px solid #90caf9;
}

.demand-total-box span {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #1565c0;
}

.demand-total-box strong {
  margin: 0.15rem 0;
  font-size: clamp(1.75rem, 3vw, 2.35rem);
  line-height: 1.05;
  color: #0d47a1;
}

.demand-total-box em {
  font-style: normal;
  font-weight: 650;
  color: #546e7a;
  font-size: 0.8125rem;
}

.demand-ai {
  border-left: 4px solid #2e7d32;
  background: linear-gradient(180deg, #f1f8f4 0%, #fff 42%);
  padding: 0.95rem 1rem;
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
  margin: 0 0 0.45rem;
  font-size: 1rem;
  color: #0d47a1;
}

.demand-ai__summary {
  margin: 0 0 0.75rem;
  line-height: 1.55;
  color: #37474f;
  font-size: 0.875rem;
}

.demand-ai__cols {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
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
  padding-left: 1.1rem;
  color: #37474f;
  line-height: 1.5;
  font-size: 0.8125rem;
}

.demand-ai__cols li + li {
  margin-top: 0.35rem;
}

.demand-ai__similar {
  margin-top: auto;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(13, 71, 161, 0.12);
}

.demand-ai__similar-label {
  display: block;
  margin-bottom: 0.45rem;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #607d8b;
}

.demand-ai__similar-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.5rem;
}

.demand-ai__similar-link {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: #fff;
  border: 1px solid #90caf9;
  color: #1565c0;
  font-size: 0.8125rem;
  font-weight: 650;
  text-decoration: none;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.demand-ai__similar-link:hover {
  background: #e3f2fd;
  border-color: #42a5f5;
  text-decoration: none;
}

.demand-ai__similar-sep {
  color: #90a4ae;
  font-weight: 700;
  user-select: none;
}


.dss-input:focus-visible,
.dss-btn:focus-visible {
  outline: 2px solid #1976d2;
  outline-offset: 2px;
}

@media (max-width: 960px) {
  .demand-layout {
    grid-template-columns: 1fr;
  }

  .demand-main--split {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 641px) and (max-width: 960px) {
  .demand-form-row {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .demand-form-row {
    grid-template-columns: 1fr;
  }
}
</style>
