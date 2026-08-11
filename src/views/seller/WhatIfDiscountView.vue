<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { dssApi } from '@/api/services'
import type { SellerWhatIfApi } from '@/api/real/dss'
import { useAuthStore } from '@/stores/auth'
import { loadSellerCatalogForDss } from '@/utils/sellerCatalog'
import {
  PRICE_CHANGE_MAX,
  PRICE_CHANGE_MIN,
  PRICE_CHANGE_STEP,
  SIMULATION_PERIOD_OPTIONS,
  formatPriceChangeLabel,
  formatQuantity,
  formatVndCurrency,
  mapSellerWhatIfError,
  validateSellerWhatIfForm,
} from '@/utils/sellerWhatIf'
import { buildWhatIfSystemJudgment } from '@/utils/sellerDssModuleAi'
import DssProfitBreakdownPanel from '@/components/dss/DssProfitBreakdownPanel.vue'
import type { SalesQuantityTargetApi, TargetProfitApi } from '@/api/real/dss'

type ScenarioMode = 'discount' | 'targetProfit' | 'salesQty'

interface SellerProductOption {
  id: number
  name: string
}

const auth = useAuthStore()

const scenarioMode = ref<ScenarioMode>('discount')
const products = ref<SellerProductOption[]>([])
const productsLoading = ref(false)
const productsError = ref('')

const productId = ref<number | ''>('')
const priceChangePercent = ref(0)
const simulationPeriod = ref(30)
const targetProfitVnd = ref(500_000_000)
const increasePercent = ref(20)

const fieldErrors = ref<{
  productId?: string
  discountPercentage?: string
  priceChangePercent?: string
  simulationPeriod?: string
}>({})
const submitting = ref(false)
const submitError = ref('')
const successMessage = ref('')
const result = ref<SellerWhatIfApi | null>(null)
const targetResult = ref<TargetProfitApi | null>(null)
const salesQtyResult = ref<SalesQuantityTargetApi | null>(null)
const resultStale = ref(false)

let requestSeq = 0
let skipStaleWatch = false

const selectedProduct = computed(() =>
  products.value.find((p) => p.id === productId.value) ?? null,
)

const canSubmit = computed(
  () => !submitting.value && !productsLoading.value && products.value.length > 0,
)

const showResults = computed(() => {
  if (resultStale.value) return false
  if (scenarioMode.value === 'discount') return Boolean(result.value)
  if (scenarioMode.value === 'targetProfit') return Boolean(targetResult.value)
  return Boolean(salesQtyResult.value)
})

const activeDiscountResult = computed(() =>
  scenarioMode.value === 'discount' ? result.value : null,
)

const systemJudgment = computed(() => {
  const r = activeDiscountResult.value
  if (!r || resultStale.value) return ''
  return buildWhatIfSystemJudgment({
    discountPercentage: Math.abs(r.priceChangePercent ?? r.discountPercentage ?? 0),
    currentProfit: r.currentProfit,
    expectedProfit: r.expectedProfit,
  })
})

watch([productId, priceChangePercent, simulationPeriod, targetProfitVnd, increasePercent, scenarioMode], () => {
  if (skipStaleWatch) return
  if (result.value || targetResult.value || salesQtyResult.value) {
    resultStale.value = true
    successMessage.value = ''
  }
})

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
      productsError.value = 'Bạn chưa có sản phẩm nào để phân tích what-if.'
      productId.value = ''
    } else if (!products.value.some((p) => p.id === productId.value)) {
      skipStaleWatch = true
      productId.value = products.value[0].id
      skipStaleWatch = false
    }
  } catch (e) {
    products.value = []
    productId.value = ''
    productsError.value = e instanceof Error ? e.message : 'Không tải được danh sách sản phẩm.'
  } finally {
    productsLoading.value = false
  }
}

async function onSubmit() {
  if (submitting.value) return
  if (scenarioMode.value === 'targetProfit') return submitTargetProfit()
  if (scenarioMode.value === 'salesQty') return submitSalesQty()
  return submitDiscount()
}

async function submitDiscount() {
  successMessage.value = ''
  submitError.value = ''
  fieldErrors.value = {}

  const validated = validateSellerWhatIfForm({
    productId: productId.value,
    priceChangePercent: priceChangePercent.value,
    simulationPeriod: simulationPeriod.value,
  })

  if (!validated.ok) {
    fieldErrors.value = validated.errors
    return
  }

  const seq = ++requestSeq
  submitting.value = true
  try {
    const data = await dssApi.analyzeSellerWhatIf(validated.payload)
    if (seq !== requestSeq) return
    result.value = data
    targetResult.value = null
    salesQtyResult.value = null
    resultStale.value = false
    successMessage.value = 'Phân tích kịch bản giảm giá thành công.'
  } catch (e) {
    if (seq !== requestSeq) return
    submitError.value = mapSellerWhatIfError(e)
  } finally {
    if (seq === requestSeq) submitting.value = false
  }
}

async function submitTargetProfit() {
  successMessage.value = ''
  submitError.value = ''
  fieldErrors.value = {}
  if (!productId.value || targetProfitVnd.value <= 0) {
    fieldErrors.value = { productId: !productId.value ? 'Chọn sản phẩm.' : undefined }
    return
  }
  const seq = ++requestSeq
  submitting.value = true
  try {
    const data = await dssApi.analyzeTargetProfit({
      productId: Number(productId.value),
      targetProfitVnd: targetProfitVnd.value,
      simulationPeriod: simulationPeriod.value,
    })
    if (seq !== requestSeq) return
    targetResult.value = data
    result.value = null
    salesQtyResult.value = null
    resultStale.value = false
    successMessage.value = 'Phân tích mục tiêu lợi nhuận thành công.'
  } catch (e) {
    if (seq !== requestSeq) return
    submitError.value = mapSellerWhatIfError(e)
  } finally {
    if (seq === requestSeq) submitting.value = false
  }
}

async function submitSalesQty() {
  successMessage.value = ''
  submitError.value = ''
  fieldErrors.value = {}
  if (!productId.value) {
    fieldErrors.value = { productId: 'Chọn sản phẩm.' }
    return
  }
  const seq = ++requestSeq
  submitting.value = true
  try {
    const data = await dssApi.analyzeSalesQuantityTarget({
      productId: Number(productId.value),
      increasePercent: increasePercent.value,
      simulationPeriod: simulationPeriod.value,
    })
    if (seq !== requestSeq) return
    salesQtyResult.value = data
    result.value = null
    targetResult.value = null
    resultStale.value = false
    successMessage.value = 'Phân tích mục tiêu số lượng bán thành công.'
  } catch (e) {
    if (seq !== requestSeq) return
    submitError.value = mapSellerWhatIfError(e)
  } finally {
    if (seq === requestSeq) submitting.value = false
  }
}

function resetResult() {
  requestSeq += 1
  submitting.value = false
  result.value = null
  targetResult.value = null
  salesQtyResult.value = null
  resultStale.value = false
  successMessage.value = ''
  submitError.value = ''
  fieldErrors.value = {}
}

function retrySubmit() {
  void onSubmit()
}
</script>

<template>
  <div class="dss-page">
    <header class="dss-page__header">
      <nav class="dss-crumb" aria-label="Breadcrumb">
        <RouterLink to="/seller/products">Bảng điều khiển người bán</RouterLink>
        <span>/</span>
        <RouterLink to="/seller/dss">DSS</RouterLink>
        <span>/</span>
        <span>Phân tích kịch bản</span>
      </nav>
      <h1>Phân tích kịch bản — Giá & lợi nhuận</h1>
      <p class="dss-page__sub">
        Mô phỏng giảm giá, mục tiêu lợi nhuận và mục tiêu số lượng bán — có giải thích rõ kỳ dự báo.
      </p>
    </header>

    <div class="dss-tab-row" role="tablist" aria-label="Loại kịch bản">
      <button
        type="button"
        role="tab"
        class="dss-tab"
        :class="{ 'dss-tab--active': scenarioMode === 'discount' }"
        @click="scenarioMode = 'discount'"
      >
        Giảm / tăng giá
      </button>
      <button
        type="button"
        role="tab"
        class="dss-tab"
        :class="{ 'dss-tab--active': scenarioMode === 'targetProfit' }"
        @click="scenarioMode = 'targetProfit'"
      >
        Mục tiêu lợi nhuận
      </button>
      <button
        type="button"
        role="tab"
        class="dss-tab"
        :class="{ 'dss-tab--active': scenarioMode === 'salesQty' }"
        @click="scenarioMode = 'salesQty'"
      >
        Mục tiêu số lượng
      </button>
    </div>

    <div class="dss-sim-banner" role="note">
      <strong>Mô phỏng</strong>
      Đây là kết quả mô phỏng. Giá sản phẩm thực tế không bị thay đổi.
    </div>

    <section class="dss-card" aria-labelledby="whatif-config-title">
      <h2 id="whatif-config-title" class="dss-card__title">Tham số mô phỏng</h2>

      <p v-if="productsLoading" class="dss-hint" role="status">Đang tải sản phẩm…</p>
      <p v-else-if="productsError" class="dss-alert dss-alert--warn" role="alert">{{ productsError }}</p>

      <form class="dss-form" @submit.prevent="onSubmit">
        <div class="dss-form-grid">
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
            <small id="product-help" class="dss-hint">Chỉ sản phẩm thuộc Seller hiện tại.</small>
            <small v-if="selectedProduct" class="dss-selected-name">
              Đã chọn: <strong>{{ selectedProduct.name }}</strong>
            </small>
            <small v-if="fieldErrors.productId" id="product-error" class="dss-field-error" role="alert">
              {{ fieldErrors.productId }}
            </small>
          </label>

          <label class="dss-field">
            <span id="period-label">Kỳ dự báo</span>
            <select
              v-model.number="simulationPeriod"
              class="dss-input"
              :disabled="submitting"
              aria-labelledby="period-label"
              aria-describedby="period-help period-error"
              :aria-invalid="Boolean(fieldErrors.simulationPeriod)"
            >
              <option v-for="d in SIMULATION_PERIOD_OPTIONS" :key="d" :value="d">{{ d }} ngày</option>
            </select>
            <small id="period-help" class="dss-hint">Kỳ mô phỏng nhu cầu / lợi nhuận.</small>
            <small
              v-if="fieldErrors.simulationPeriod"
              id="period-error"
              class="dss-field-error"
              role="alert"
            >
              {{ fieldErrors.simulationPeriod }}
            </small>
          </label>

          <label v-if="scenarioMode === 'discount'" class="dss-field dss-field--span2">
            <span id="price-change-label">
              Thay đổi giá —
              <strong>{{ formatPriceChangeLabel(priceChangePercent) }}</strong>
            </span>
            <div class="dss-bidirectional-slider" aria-hidden="true">
              <span class="dss-bidirectional-slider__side">−{{ PRICE_CHANGE_MAX }}%</span>
              <span class="dss-bidirectional-slider__center">0%</span>
              <span class="dss-bidirectional-slider__side">+{{ PRICE_CHANGE_MAX }}%</span>
            </div>
            <input
              v-model.number="priceChangePercent"
              type="range"
              class="dss-slider dss-slider--bidirectional"
              :min="PRICE_CHANGE_MIN"
              :max="PRICE_CHANGE_MAX"
              :step="PRICE_CHANGE_STEP"
              :disabled="submitting"
              aria-labelledby="price-change-label"
              aria-describedby="price-change-help"
              :aria-valuemin="PRICE_CHANGE_MIN"
              :aria-valuemax="PRICE_CHANGE_MAX"
              :aria-valuenow="priceChangePercent"
              :aria-valuetext="formatPriceChangeLabel(priceChangePercent)"
            />
            <small id="price-change-help" class="dss-hint">
              Kéo <strong>trái</strong> = giảm giá · <strong>0</strong> = giữ giá · Kéo <strong>phải</strong> = tăng giá (±{{ PRICE_CHANGE_MAX }}%).
            </small>
            <small
              v-if="fieldErrors.priceChangePercent"
              class="dss-field-error"
              role="alert"
            >
              {{ fieldErrors.priceChangePercent }}
            </small>
          </label>

          <label v-if="scenarioMode === 'targetProfit'" class="dss-field dss-field--span2">
            <span id="target-profit-label">Mục tiêu lợi nhuận ròng (VND)</span>
            <input
              v-model.number="targetProfitVnd"
              type="number"
              min="1"
              step="1000000"
              class="dss-input"
              :disabled="submitting"
              aria-labelledby="target-profit-label"
            />
            <small class="dss-hint">Ví dụ: 500000000 = 500 triệu VND lợi nhuận ròng trong kỳ dự báo.</small>
          </label>

          <label v-if="scenarioMode === 'salesQty'" class="dss-field dss-field--span2">
            <span id="increase-label">Tăng số lượng bán (%)</span>
            <input
              v-model.number="increasePercent"
              type="range"
              class="dss-slider"
              min="1"
              max="100"
              step="1"
              :disabled="submitting"
              aria-labelledby="increase-label"
            />
            <small class="dss-hint">Mục tiêu tăng <strong>{{ increasePercent }}%</strong> so với dự báo hiện tại.</small>
          </label>
        </div>

        <div class="dss-actions">
          <button
            type="submit"
            class="dss-btn dss-btn--primary"
            :disabled="!canSubmit"
            :aria-busy="submitting"
          >
            {{ submitting ? 'Đang phân tích…' : 'Phân tích kịch bản' }}
          </button>
          <button
            v-if="result"
            type="button"
            class="dss-btn dss-btn--outline"
            :disabled="submitting"
            @click="resetResult"
          >
            Phân tích khác
          </button>
        </div>
      </form>

      <div v-if="submitError" class="dss-alert dss-alert--warn" role="alert" style="margin-top: 1rem">
        <p style="margin: 0">{{ submitError }}</p>
        <p class="dss-hint" style="margin-top: 0.35rem">
          Gợi ý: cần dự báo nhu cầu (FR01), lịch sử giá/elasticity (FR03), và sản phẩm có cost hợp lệ.
        </p>
        <button
          type="button"
          class="dss-btn dss-btn--outline"
          style="margin-top: 0.65rem"
          :disabled="submitting"
          @click="retrySubmit"
        >
          Thử lại
        </button>
      </div>
      <div
        v-if="successMessage && showResults"
        class="dss-alert dss-alert--success"
        role="status"
        style="margin-top: 1rem"
      >
        {{ successMessage }}
      </div>
      <div
        v-if="resultStale && result"
        class="dss-alert dss-alert--warn"
        role="status"
        style="margin-top: 1rem"
      >
        Tham số đã đổi (product / discount / period). Kết quả cũ đang ẩn — bấm “Phân tích kịch bản” để chạy lại.
      </div>
    </section>

    <section v-if="!showResults && !(resultStale && (result || targetResult || salesQtyResult))" class="dss-card" aria-labelledby="whatif-empty-title">
      <div class="dss-empty" role="status">
        <div class="dss-empty__art" aria-hidden="true">◇</div>
        <h2 id="whatif-empty-title">{{ resultStale ? 'Kết quả đã cũ' : 'Chưa có kết quả mô phỏng' }}</h2>
        <p>
          {{
            resultStale
              ? 'Form không còn khớp kết quả trước đó. Submit lại để lấy số liệu mới từ backend.'
              : 'Chọn sản phẩm, mức giảm và kỳ mô phỏng rồi bấm “Phân tích kịch bản”.'
          }}
        </p>
      </div>
    </section>

    <template v-if="showResults && activeDiscountResult">
      <div class="dss-sim-banner dss-sim-banner--soft" role="status">
        Kết quả bên dưới là mô phỏng. Giá sản phẩm thực tế không bị thay đổi.
      </div>

      <section class="dss-card dss-whatif-results" aria-labelledby="whatif-results-title">
        <h2 id="whatif-results-title" class="dss-card__title">Kết quả mô phỏng — Điều chỉnh giá</h2>
        <p v-if="activeDiscountResult.forecastPeriodLabel" class="dss-meta">
          <span>Kỳ áp dụng</span>{{ activeDiscountResult.forecastPeriodLabel }}
        </p>
        <p v-if="activeDiscountResult.recommendation" class="dss-recommendation">
          {{ activeDiscountResult.recommendation }}
        </p>
        <p v-if="activeDiscountResult.recommendationReason" class="dss-hint">
          {{ activeDiscountResult.recommendationReason }}
        </p>

        <h3 class="dss-kpi-group__title">Chỉ số sản phẩm</h3>
        <div class="dss-kpi-grid">
          <article class="dss-kpi">
            <span class="dss-kpi__label">Giá vốn</span>
            <strong>{{ formatVndCurrency(activeDiscountResult.costPrice) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Giá hiện tại</span>
            <strong>{{ formatVndCurrency(activeDiscountResult.currentPrice) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Giá mới (mô phỏng)</span>
            <strong>{{ formatVndCurrency(activeDiscountResult.newPrice) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Nhu cầu dự báo</span>
            <strong>{{ formatQuantity(activeDiscountResult.forecastDemand) }}</strong>
          </article>
        </div>

        <h3 class="dss-kpi-group__title">Tác động dự kiến</h3>
        <div class="dss-kpi-grid">
          <article class="dss-kpi">
            <span class="dss-kpi__label">Thay đổi giá</span>
            <strong>{{ formatPriceChangeLabel(activeDiscountResult.priceChangePercent ?? -activeDiscountResult.discountPercentage) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Doanh thu kỳ vọng</span>
            <strong>{{ formatVndCurrency(activeDiscountResult.expectedRevenue ?? 0) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Lợi nhuận ròng hiện tại</span>
            <strong>{{ formatVndCurrency(activeDiscountResult.currentProfit) }}</strong>
          </article>
          <article class="dss-kpi dss-kpi--accent">
            <span class="dss-kpi__label">Lợi nhuận ròng kỳ vọng</span>
            <strong>{{ formatVndCurrency(activeDiscountResult.expectedProfit) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Nhu cầu sau giảm</span>
            <strong>{{ formatQuantity(activeDiscountResult.predictedDemand) }}</strong>
          </article>
        </div>

        <DssProfitBreakdownPanel
          title="Chi tiết lợi nhuận — hiện tại"
          :breakdown="activeDiscountResult.currentProfitBreakdown"
        />
        <DssProfitBreakdownPanel
          title="Chi tiết lợi nhuận — sau giảm giá"
          :breakdown="activeDiscountResult.expectedProfitBreakdown"
        />

        <h3 class="dss-kpi-group__title">Hòa vốn</h3>
        <div class="dss-kpi-grid dss-kpi-grid--2">
          <article class="dss-kpi">
            <span class="dss-kpi__label">Hòa vốn (số lượng)</span>
            <strong>{{ formatQuantity(activeDiscountResult.breakEvenQuantity) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Số lượng cần thêm</span>
            <strong>{{ formatQuantity(activeDiscountResult.additionalUnitsRequired) }}</strong>
          </article>
        </div>

        <div v-if="systemJudgment" class="dss-system-alert" role="status">
          {{ systemJudgment }}
        </div>
        <p v-if="activeDiscountResult.businessInsight" class="dss-hint">{{ activeDiscountResult.businessInsight }}</p>
      </section>
    </template>

    <template v-if="showResults && targetResult">
      <section class="dss-card" aria-labelledby="target-profit-title">
        <h2 id="target-profit-title" class="dss-card__title">Mục tiêu lợi nhuận</h2>
        <p class="dss-meta"><span>Kỳ</span>{{ targetResult.forecastPeriodLabel }}</p>
        <p class="dss-recommendation">{{ targetResult.recommendation }}</p>
        <p class="dss-hint">{{ targetResult.recommendationReason }}</p>
        <div class="dss-kpi-grid">
          <article class="dss-kpi">
            <span class="dss-kpi__label">Mục tiêu LN ròng</span>
            <strong>{{ formatVndCurrency(targetResult.targetProfitVnd) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Đạt được?</span>
            <strong>{{ targetResult.achievable ? 'Có' : 'Chưa' }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Giá đề xuất</span>
            <strong>{{ formatVndCurrency(targetResult.recommendedPrice) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">% điều chỉnh giá</span>
            <strong>{{ targetResult.recommendedPriceChangePercent }}%</strong>
          </article>
        </div>
        <DssProfitBreakdownPanel title="Hiện tại" :breakdown="targetResult.currentSituation" />
        <DssProfitBreakdownPanel title="Kịch bản gần mục tiêu nhất" :breakdown="targetResult.targetSituation" />
      </section>
    </template>

    <template v-if="showResults && salesQtyResult">
      <section class="dss-card" aria-labelledby="sales-qty-title">
        <h2 id="sales-qty-title" class="dss-card__title">Mục tiêu số lượng bán</h2>
        <p class="dss-meta"><span>Kỳ</span>{{ salesQtyResult.forecastPeriodLabel }}</p>
        <p class="dss-recommendation">{{ salesQtyResult.recommendation }}</p>
        <p class="dss-hint">{{ salesQtyResult.recommendationReason }}</p>
        <div class="dss-kpi-grid">
          <article class="dss-kpi">
            <span class="dss-kpi__label">Dự báo hiện tại</span>
            <strong>{{ formatQuantity(salesQtyResult.currentForecastQuantity) }} SP</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Mục tiêu</span>
            <strong>{{ formatQuantity(salesQtyResult.targetQuantity) }} SP</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Giá gợi ý</span>
            <strong>{{ formatVndCurrency(salesQtyResult.suggestedPrice) }}</strong>
          </article>
        </div>
        <DssProfitBreakdownPanel title="Hiện tại" :breakdown="salesQtyResult.currentSituation" />
        <DssProfitBreakdownPanel title="Sau điều chỉnh" :breakdown="salesQtyResult.targetSituation" />
      </section>
    </template>
  </div>
</template>

<style scoped>
.dss-bidirectional-slider {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  color: #64748b;
  margin: 0.35rem 0 0.15rem;
}
.dss-bidirectional-slider__center {
  font-weight: 700;
  color: #0f766e;
}
.dss-slider--bidirectional {
  accent-color: #0f766e;
}
.dss-tab-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.dss-tab {
  border: 1px solid var(--dss-border, #cbd5e1);
  background: #fff;
  border-radius: 999px;
  padding: 0.45rem 1rem;
  font-size: 0.875rem;
  cursor: pointer;
}
.dss-tab--active {
  background: #0f766e;
  color: #fff;
  border-color: #0f766e;
}
.dss-recommendation {
  font-weight: 600;
  color: #0f766e;
  margin: 0.5rem 0;
  line-height: 1.45;
}
.dss-hint {
  display: block;
  margin-top: 0.35rem;
  color: var(--dss-muted, #607d8b);
  font-size: 0.8125rem;
  line-height: 1.4;
}

.dss-selected-name {
  display: block;
  margin-top: 0.4rem;
  font-size: 0.875rem;
  color: #1565c0;
}

.dss-field-error {
  display: block;
  margin-top: 0.35rem;
  color: #c62828;
  font-size: 0.8125rem;
}

.dss-preview {
  display: block;
  margin-top: 0.4rem;
  font-size: 0.8125rem;
  color: #455a64;
}

.dss-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
}

.dss-field--span2 {
  grid-column: 1 / -1;
}

.dss-slider {
  width: 100%;
  margin-top: 0.5rem;
  accent-color: #1976d2;
}

.dss-input:focus-visible,
.dss-btn:focus-visible,
.dss-slider:focus-visible {
  outline: 2px solid #1976d2;
  outline-offset: 2px;
}

.dss-sim-banner {
  margin-bottom: 1rem;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  border: 1px solid #ffe082;
  background: #fff8e1;
  color: #e65100;
  font-size: 0.9rem;
  line-height: 1.45;
}

.dss-sim-banner strong {
  display: inline-block;
  margin-right: 0.35rem;
}

.dss-sim-banner--soft {
  background: #fffdf6;
  color: #f57c00;
}

.dss-whatif-results {
  border-color: #e3e8ef;
}

.dss-kpi-group__title {
  margin: 1rem 0 0.55rem;
  font-size: 0.8125rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #546e7a;
}

.dss-kpi-group__title:first-of-type {
  margin-top: 0.35rem;
}

.dss-kpi-grid--2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.dss-system-alert {
  margin-top: 1.15rem;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  border: 1px solid #ffe082;
  background: #fffde7;
  color: #5d4037;
  font-size: 0.9375rem;
  line-height: 1.55;
}
</style>
