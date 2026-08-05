<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { dssApi } from '@/api/services'
import type { SellerWhatIfApi } from '@/api/real/dss'
import { useAuthStore } from '@/stores/auth'
import { loadSellerCatalogForDss } from '@/utils/sellerCatalog'
import {
  DISCOUNT_MAX,
  DISCOUNT_MIN,
  DISCOUNT_STEP,
  SIMULATION_PERIOD_OPTIONS,
  formatDiscountLabel,
  formatQuantity,
  formatVndCurrency,
  mapSellerWhatIfError,
  profitInsightBadge,
  profitInsightBadgeLabel,
  validateSellerWhatIfForm,
} from '@/utils/sellerWhatIf'
import { buildWhatIfAiInsight } from '@/utils/sellerDssModuleAi'

interface SellerProductOption {
  id: number
  name: string
}

const auth = useAuthStore()

const products = ref<SellerProductOption[]>([])
const productsLoading = ref(false)
const productsError = ref('')

const productId = ref<number | ''>('')
const discountPercentage = ref(10)
const simulationPeriod = ref(30)

const fieldErrors = ref<{
  productId?: string
  discountPercentage?: string
  simulationPeriod?: string
}>({})
const submitting = ref(false)
const submitError = ref('')
const successMessage = ref('')
const result = ref<SellerWhatIfApi | null>(null)
const resultStale = ref(false)

let requestSeq = 0
let skipStaleWatch = false

const selectedProduct = computed(() =>
  products.value.find((p) => p.id === productId.value) ?? null,
)

const canSubmit = computed(
  () => !submitting.value && !productsLoading.value && products.value.length > 0,
)

const showResults = computed(() => Boolean(result.value) && !resultStale.value)

const insightBadge = computed(() => {
  if (!result.value) return null
  return profitInsightBadge(result.value.currentProfit, result.value.expectedProfit)
})

const selectedProductName = computed(
  () => products.value.find((p) => p.id === productId.value)?.name || '',
)

const aiInsight = computed(() => {
  if (!result.value || resultStale.value) return null
  return buildWhatIfAiInsight({
    productName: selectedProductName.value,
    discountPercentage: result.value.discountPercentage,
    currentProfit: result.value.currentProfit,
    expectedProfit: result.value.expectedProfit,
    breakEvenQuantity: result.value.breakEvenQuantity,
    additionalUnitsRequired: result.value.additionalUnitsRequired,
    predictedDemand: result.value.predictedDemand,
    businessInsight: result.value.businessInsight,
  })
})

watch([productId, discountPercentage, simulationPeriod], () => {
  if (skipStaleWatch) return
  if (result.value) {
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

  successMessage.value = ''
  submitError.value = ''
  fieldErrors.value = {}

  const validated = validateSellerWhatIfForm({
    productId: productId.value,
    discountPercentage: discountPercentage.value,
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
    resultStale.value = false
    successMessage.value = 'Phân tích kịch bản giảm giá thành công.'
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
        <span>What-if giảm giá</span>
      </nav>
      <h1>What-if — Giảm giá & lợi nhuận</h1>
      <p class="dss-page__sub">
        Mô phỏng tác động giảm giá tới nhu cầu và lợi nhuận. Đây chỉ là simulation — không cập nhật giá sản phẩm thật.
      </p>
    </header>

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
            <span id="period-label">Simulation Period</span>
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

          <label class="dss-field dss-field--span2">
            <span id="discount-label">
              Discount Percentage —
              <strong>{{ formatDiscountLabel(discountPercentage) }}</strong>
            </span>
            <input
              v-model.number="discountPercentage"
              type="range"
              class="dss-slider"
              :min="DISCOUNT_MIN"
              :max="DISCOUNT_MAX"
              :step="DISCOUNT_STEP"
              :disabled="submitting"
              aria-labelledby="discount-label"
              aria-describedby="discount-help discount-preview discount-error"
              :aria-valuemin="DISCOUNT_MIN"
              :aria-valuemax="DISCOUNT_MAX"
              :aria-valuenow="discountPercentage"
              :aria-valuetext="formatDiscountLabel(discountPercentage)"
              :aria-invalid="Boolean(fieldErrors.discountPercentage)"
            />
            <small id="discount-help" class="dss-hint">
              Min {{ DISCOUNT_MIN }}% · Max {{ DISCOUNT_MAX }}% · Step {{ DISCOUNT_STEP }}%.
              Kéo slider không gọi API — chỉ submit mới phân tích.
            </small>
            <small id="discount-preview" class="dss-preview">
              Preview: mức giảm đang chọn <strong>{{ discountPercentage }}%</strong>.
              New Price chỉ hiển thị sau khi backend trả kết quả.
            </small>
            <small
              v-if="fieldErrors.discountPercentage"
              id="discount-error"
              class="dss-field-error"
              role="alert"
            >
              {{ fieldErrors.discountPercentage }}
            </small>
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

    <section v-if="!result || resultStale" class="dss-card" aria-labelledby="whatif-empty-title">
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

    <template v-if="showResults && result">
      <div class="dss-sim-banner dss-sim-banner--soft" role="status">
        Kết quả bên dưới là mô phỏng. Giá sản phẩm thực tế không bị thay đổi.
      </div>

      <section class="dss-card" aria-labelledby="whatif-kpi-title">
        <h2 id="whatif-kpi-title" class="dss-card__title">Chỉ số mô phỏng</h2>
        <div class="dss-kpi-grid dss-kpi-grid--6">
          <article class="dss-kpi">
            <span class="dss-kpi__label">Current Price</span>
            <strong>{{ formatVndCurrency(result.currentPrice) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">New Price (mô phỏng)</span>
            <strong>{{ formatVndCurrency(result.newPrice) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Cost Price</span>
            <strong>{{ formatVndCurrency(result.costPrice) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Forecast Demand</span>
            <strong>{{ formatQuantity(result.forecastDemand) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Predicted Demand</span>
            <strong>{{ formatQuantity(result.predictedDemand) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Discount</span>
            <strong>{{ formatDiscountLabel(result.discountPercentage) }}</strong>
          </article>
        </div>

        <div class="dss-kpi-grid" style="margin-top: 0.85rem">
          <article class="dss-kpi">
            <span class="dss-kpi__label">Current Profit</span>
            <strong>{{ formatVndCurrency(result.currentProfit) }}</strong>
          </article>
          <article class="dss-kpi dss-kpi--accent">
            <span class="dss-kpi__label">Expected Profit</span>
            <strong>{{ formatVndCurrency(result.expectedProfit) }}</strong>
          </article>
        </div>
      </section>

      <section class="dss-card" aria-labelledby="whatif-breakeven-title">
        <h2 id="whatif-breakeven-title" class="dss-card__title">Hòa vốn & đơn vị cần thêm</h2>
        <div class="dss-kpi-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr))">
          <article class="dss-kpi">
            <span class="dss-kpi__label">Break-even Quantity</span>
            <strong>{{ formatQuantity(result.breakEvenQuantity) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Additional Units Required</span>
            <strong>{{ formatQuantity(result.additionalUnitsRequired) }}</strong>
          </article>
        </div>
      </section>

      <section
        v-if="aiInsight"
        class="dss-card dss-ai-panel"
        :class="`dss-ai-panel--${aiInsight.tone}`"
        aria-labelledby="whatif-insight-title"
      >
        <div class="dss-ai-panel__head">
          <div>
            <span class="dss-ai-panel__badge">{{ aiInsight.badge }}</span>
            <h2 id="whatif-insight-title" class="dss-card__title" style="margin: 0">Nhận định AI</h2>
          </div>
          <span
            v-if="insightBadge"
            class="dss-badge"
            :class="`dss-badge--${insightBadge.toLowerCase()}`"
          >
            {{ profitInsightBadgeLabel(insightBadge) }}
          </span>
        </div>
        <h3 class="dss-ai-panel__title">{{ aiInsight.title }}</h3>
        <p class="dss-ai-panel__summary">{{ aiInsight.summary }}</p>
        <div class="dss-ai-panel__cols">
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
      </section>

      <section class="dss-card" aria-labelledby="whatif-compare-title">
        <h2 id="whatif-compare-title" class="dss-card__title">So sánh Hiện tại / Kịch bản</h2>
        <div class="dss-table-wrap" role="region" aria-label="Bảng so sánh what-if" tabindex="0">
          <table class="dss-table">
            <thead>
              <tr>
                <th scope="col">Chỉ số</th>
                <th scope="col">Hiện tại</th>
                <th scope="col">Sau giảm giá (kịch bản)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Giá bán</th>
                <td>{{ formatVndCurrency(result.currentPrice) }}</td>
                <td>{{ formatVndCurrency(result.newPrice) }}</td>
              </tr>
              <tr>
                <th scope="row">Nhu cầu</th>
                <td>{{ formatQuantity(result.forecastDemand) }}</td>
                <td>{{ formatQuantity(result.predictedDemand) }}</td>
              </tr>
              <tr>
                <th scope="row">Tổng lợi nhuận</th>
                <td>{{ formatVndCurrency(result.currentProfit) }}</td>
                <td>
                  <strong>{{ formatVndCurrency(result.expectedProfit) }}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
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
.dss-slider:focus-visible,
.dss-table-wrap:focus-visible {
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

.dss-insight-card {
  border-color: #90caf9;
  background: linear-gradient(180deg, #e3f2fd, #fff);
}

.dss-insight-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.65rem;
}

.dss-insight-text {
  margin: 0;
  font-size: 1rem;
  line-height: 1.55;
  color: #0d47a1;
  font-weight: 600;
}

.dss-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  border: 1px solid transparent;
}

.dss-badge--increase {
  background: #e8f5e9;
  color: #1b5e20;
  border-color: #a5d6a7;
}

.dss-badge--maintain {
  background: #eceff1;
  color: #455a64;
  border-color: #cfd8dc;
}

.dss-badge--decrease {
  background: #fff8e1;
  color: #e65100;
  border-color: #ffe082;
}

.dss-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border: 1px solid var(--dss-border, #e3e8ef);
  border-radius: 10px;
}

.dss-table {
  width: 100%;
  min-width: 480px;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.dss-table th,
.dss-table td {
  padding: 0.75rem 0.85rem;
  text-align: left;
  border-bottom: 1px solid #eceff1;
}

.dss-table thead th {
  background: #f5f9ff;
  color: #1565c0;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.dss-table tbody th {
  font-weight: 650;
  color: #455a64;
  background: #fafafa;
}
</style>
