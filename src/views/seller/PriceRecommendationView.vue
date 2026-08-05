<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { dssApi } from '@/api/services'
import type { PricePredictionApi } from '@/api/real/dss'
import { useAuthStore } from '@/stores/auth'
import { loadSellerCatalogForDss } from '@/utils/sellerCatalog'
import {
  defaultPriceRange,
  formatElasticity,
  formatQuantity,
  formatSignedPercent,
  formatVndCurrency,
  isBestScenarioRow,
  mapPricePredictionError,
  normalizeScenarios,
  scenarioTone,
  scenarioToneLabel,
  todayIsoDate,
  validatePricePredictionForm,
} from '@/utils/pricePrediction'
import { buildPricePredictionAiInsight } from '@/utils/sellerDssModuleAi'

interface SellerProductOption {
  id: number
  name: string
}

const auth = useAuthStore()
const rangeDefaults = defaultPriceRange()

const products = ref<SellerProductOption[]>([])
const productsLoading = ref(false)
const productsError = ref('')

const productId = ref<number | ''>('')
const fromDate = ref(rangeDefaults.fromDate)
const toDate = ref(rangeDefaults.toDate)
const maxToDate = todayIsoDate()

const fieldErrors = ref<{ productId?: string; fromDate?: string; toDate?: string }>({})
const submitting = ref(false)
const submitError = ref('')
const successMessage = ref('')
const result = ref<PricePredictionApi | null>(null)
const resultStale = ref(false)

let requestSeq = 0
let skipStaleWatch = false

const selectedProduct = computed(() =>
  products.value.find((p) => p.id === productId.value) ?? null,
)

const scenarios = computed(() => normalizeScenarios(result.value?.scenarios))

const canSubmit = computed(
  () => !submitting.value && !productsLoading.value && products.value.length > 0,
)

const showResults = computed(() => Boolean(result.value) && !resultStale.value)

const aiInsight = computed(() => {
  if (!result.value || resultStale.value) return null
  return buildPricePredictionAiInsight({
    productName: result.value.productName,
    currentPrice: result.value.currentPrice,
    cost: result.value.cost,
    averageElasticity: result.value.averageElasticity,
    totalQuantitySold: result.value.totalQuantitySold,
    best: result.value.bestScenario,
  })
})

watch([productId, fromDate, toDate], () => {
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
      productsError.value = 'Bạn chưa có sản phẩm nào để tạo khuyến nghị giá.'
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

  const validated = validatePricePredictionForm({
    productId: productId.value,
    fromDate: fromDate.value,
    toDate: toDate.value,
  })

  if (!validated.ok) {
    fieldErrors.value = validated.errors
    return
  }

  const seq = ++requestSeq
  submitting.value = true
  try {
    const data = await dssApi.createPricePrediction(validated.payload)
    if (seq !== requestSeq) return
    result.value = data
    resultStale.value = false
    successMessage.value = 'Tạo khuyến nghị giá thành công.'
  } catch (e) {
    if (seq !== requestSeq) return
    submitError.value = mapPricePredictionError(e)
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
        <span>Khuyến nghị giá</span>
      </nav>
      <h1>Khuyến nghị giá</h1>
      <p class="dss-page__sub">
        So sánh kịch bản giá theo hệ số co giãn — form, thẻ KPI và bảng scenario, không dùng biểu đồ.
      </p>
    </header>

    <!-- 1. Form -->
    <section class="dss-card" aria-labelledby="price-config-title">
      <h2 id="price-config-title" class="dss-card__title">Cấu hình khuyến nghị</h2>

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
            <small id="product-help" class="dss-hint">
              Chỉ sản phẩm thuộc Seller hiện tại.
            </small>
            <small v-if="selectedProduct" class="dss-selected-name">
              Đã chọn: <strong>{{ selectedProduct.name }}</strong>
            </small>
            <small v-if="fieldErrors.productId" id="product-error" class="dss-field-error" role="alert">
              {{ fieldErrors.productId }}
            </small>
          </label>

          <label class="dss-field">
            <span id="from-label">From Date</span>
            <input
              v-model="fromDate"
              type="date"
              class="dss-input"
              :max="toDate || maxToDate"
              :disabled="submitting"
              aria-labelledby="from-label"
              aria-describedby="from-help from-error"
              :aria-invalid="Boolean(fieldErrors.fromDate)"
              required
            />
            <small id="from-help" class="dss-hint">Ngày bắt đầu khoảng lịch sử giá / bán hàng.</small>
            <small v-if="fieldErrors.fromDate" id="from-error" class="dss-field-error" role="alert">
              {{ fieldErrors.fromDate }}
            </small>
          </label>

          <label class="dss-field">
            <span id="to-label">To Date</span>
            <input
              v-model="toDate"
              type="date"
              class="dss-input"
              :min="fromDate || undefined"
              :max="maxToDate"
              :disabled="submitting"
              aria-labelledby="to-label"
              aria-describedby="to-help to-error"
              :aria-invalid="Boolean(fieldErrors.toDate)"
              required
            />
            <small id="to-help" class="dss-hint">Không được chọn ngày trong tương lai.</small>
            <small v-if="fieldErrors.toDate" id="to-error" class="dss-field-error" role="alert">
              {{ fieldErrors.toDate }}
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
            {{ submitting ? 'Đang tạo khuyến nghị…' : 'Tạo khuyến nghị giá' }}
          </button>
          <button
            v-if="result"
            type="button"
            class="dss-btn dss-btn--outline"
            :disabled="submitting"
            @click="resetResult"
          >
            Tạo khuyến nghị khác
          </button>
        </div>
      </form>

      <div v-if="submitError" class="dss-alert dss-alert--warn" role="alert" style="margin-top: 1rem">
        <p style="margin: 0">{{ submitError }}</p>
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
        Cấu hình đã thay đổi. Kết quả cũ đang ẩn — bấm “Tạo khuyến nghị giá” để cập nhật.
      </div>
    </section>

    <!-- Empty -->
    <section v-if="!result || resultStale" class="dss-card" aria-labelledby="price-empty-title">
      <div class="dss-empty" role="status">
        <div class="dss-empty__art" aria-hidden="true">◇</div>
        <h2 id="price-empty-title">{{ resultStale ? 'Kết quả đã cũ' : 'Chưa có khuyến nghị' }}</h2>
        <p>
          {{
            resultStale
              ? 'Product hoặc khoảng thời gian đã đổi. Submit lại để lấy kịch bản mới từ backend.'
              : 'Chọn sản phẩm, From/To Date rồi bấm “Tạo khuyến nghị giá”. API chỉ được gọi khi submit.'
          }}
        </p>
      </div>
    </section>

    <template v-if="showResults && result">
      <!-- 2. Input summary -->
      <section class="dss-card" aria-labelledby="price-summary-title">
        <h2 id="price-summary-title" class="dss-card__title">Tóm tắt dữ liệu đầu vào</h2>
        <p class="dss-meta"><span>Sản phẩm</span>{{ result.productName }}</p>
        <p class="dss-meta"><span>Khoảng thời gian</span>{{ result.fromDate }} → {{ result.toDate }}</p>
        <div class="dss-kpi-grid">
          <article class="dss-kpi">
            <span class="dss-kpi__label">Current Price</span>
            <strong>{{ formatVndCurrency(result.currentPrice) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Cost</span>
            <strong>{{ formatVndCurrency(result.cost) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Average Elasticity</span>
            <strong :title="'Hệ số co giãn giá — thường là số âm'">
              {{ formatElasticity(result.averageElasticity) }}
            </strong>
            <small class="dss-hint">Thường là số âm (cầu giảm khi giá tăng).</small>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Total Quantity Sold</span>
            <strong>{{ formatQuantity(result.totalQuantitySold) }}</strong>
          </article>
        </div>
      </section>

      <!-- 3. Best recommendation -->
      <section
        v-if="result.bestScenario"
        class="dss-card dss-best-card"
        aria-labelledby="price-best-title"
      >
        <div class="dss-best-card__head">
          <h2 id="price-best-title" class="dss-card__title" style="margin: 0">
            Best Price Recommendation
          </h2>
          <span class="dss-badge dss-badge--best">Khuyến nghị</span>
        </div>
        <p class="dss-hint" style="margin-bottom: 0.85rem">
          Kịch bản tối ưu theo expected profit từ backend — không tự chọn lại trên frontend.
        </p>
        <div class="dss-kpi-grid dss-kpi-grid--6">
          <article class="dss-kpi dss-kpi--accent">
            <span class="dss-kpi__label">% Price Change</span>
            <strong>{{ formatSignedPercent(result.bestScenario.priceChangePercent) }}</strong>
            <span
              class="dss-badge"
              :class="`dss-badge--${scenarioTone(result.bestScenario.priceChangePercent)}`"
            >
              {{ scenarioToneLabel(scenarioTone(result.bestScenario.priceChangePercent)) }}
            </span>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Cost</span>
            <strong>{{ formatVndCurrency(result.bestScenario.cost) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">New Price</span>
            <strong>{{ formatVndCurrency(result.bestScenario.newPrice) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label" title="Profit/sp = New Price − Cost">Profit/sp</span>
            <strong>{{ formatVndCurrency(result.bestScenario.profitPerProduct) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Predicted Demand</span>
            <strong>{{ formatQuantity(result.bestScenario.predictedDemand) }}</strong>
          </article>
          <article class="dss-kpi dss-kpi--accent">
            <span class="dss-kpi__label" title="Expected Profit = Profit/sp × Predicted Demand">
              Expected Profit
            </span>
            <strong>{{ formatVndCurrency(result.bestScenario.expectedProfit) }}</strong>
          </article>
        </div>
      </section>

      <section
        v-if="aiInsight"
        class="dss-card dss-ai-panel"
        :class="`dss-ai-panel--${aiInsight.tone}`"
        aria-labelledby="price-ai-title"
      >
        <div class="dss-ai-panel__head">
          <div>
            <span class="dss-ai-panel__badge">{{ aiInsight.badge }}</span>
            <h2 id="price-ai-title" class="dss-card__title" style="margin: 0">Nhận định AI</h2>
          </div>
          <p class="dss-ai-panel__method">Từ elasticity + best scenario backend</p>
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

      <!-- 4. Scenario table -->
      <section class="dss-card" aria-labelledby="price-table-title">
        <h2 id="price-table-title" class="dss-card__title">Scenario Comparison</h2>
        <p class="dss-hint" style="margin-bottom: 0.85rem">
          <span title="Profit/sp = New Price − Cost">Profit/sp = New Price − Cost</span>
          ·
          <span title="Expected Profit = Profit/sp × Predicted Demand">
            Expected Profit = Profit/sp × Predicted Demand
          </span>
        </p>

        <div v-if="!scenarios.length" class="dss-empty" role="status">
          <h2>Không có scenario</h2>
          <p>Backend trả về danh sách scenarios rỗng.</p>
        </div>

        <div v-else class="dss-table-wrap" role="region" aria-label="Bảng so sánh scenario" tabindex="0">
          <table class="dss-table">
            <thead>
              <tr>
                <th scope="col">% Price Change</th>
                <th scope="col">Cost</th>
                <th scope="col">New Price</th>
                <th scope="col" title="Profit/sp = New Price − Cost">Profit/sp</th>
                <th scope="col">Predicted Demand</th>
                <th scope="col" title="Expected Profit = Profit/sp × Predicted Demand">
                  Expected Profit
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, idx) in scenarios"
                :key="`${row.priceChangePercent}-${idx}`"
                :class="{
                  'dss-table__row--best': isBestScenarioRow(row, result.bestScenario),
                  'dss-table__row--decrease': scenarioTone(row.priceChangePercent) === 'decrease',
                  'dss-table__row--increase': scenarioTone(row.priceChangePercent) === 'increase',
                  'dss-table__row--keep': scenarioTone(row.priceChangePercent) === 'keep',
                }"
              >
                <td>
                  <span class="dss-cell-stack">
                    <strong>{{ formatSignedPercent(row.priceChangePercent) }}</strong>
                    <span
                      class="dss-badge"
                      :class="[
                        `dss-badge--${scenarioTone(row.priceChangePercent)}`,
                        { 'dss-badge--best': isBestScenarioRow(row, result.bestScenario) },
                      ]"
                    >
                      <template v-if="isBestScenarioRow(row, result.bestScenario)">Khuyến nghị</template>
                      <template v-else>{{ scenarioToneLabel(scenarioTone(row.priceChangePercent)) }}</template>
                    </span>
                  </span>
                </td>
                <td>{{ formatVndCurrency(row.cost) }}</td>
                <td>{{ formatVndCurrency(row.newPrice) }}</td>
                <td>{{ formatVndCurrency(row.profitPerProduct) }}</td>
                <td>{{ formatQuantity(row.predictedDemand) }}</td>
                <td>
                  <strong>{{ formatVndCurrency(row.expectedProfit) }}</strong>
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

.dss-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
}

.dss-input:focus-visible,
.dss-btn:focus-visible,
.dss-table-wrap:focus-visible {
  outline: 2px solid #1976d2;
  outline-offset: 2px;
}

.dss-best-card {
  border-color: #a5d6a7;
  background: linear-gradient(180deg, #e8f5e9, #fff);
}

.dss-best-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.dss-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  border: 1px solid transparent;
}

.dss-badge--best {
  background: #e8f5e9;
  color: #1b5e20;
  border-color: #a5d6a7;
}

.dss-badge--decrease {
  background: #fff8e1;
  color: #e65100;
  border-color: #ffe082;
}

.dss-badge--keep {
  background: #eceff1;
  color: #455a64;
  border-color: #cfd8dc;
}

.dss-badge--increase {
  background: #e3f2fd;
  color: #1565c0;
  border-color: #90caf9;
}

.dss-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border: 1px solid var(--dss-border, #e3e8ef);
  border-radius: 10px;
}

.dss-table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.dss-table th,
.dss-table td {
  padding: 0.75rem 0.85rem;
  text-align: left;
  border-bottom: 1px solid #eceff1;
  white-space: nowrap;
}

.dss-table th {
  background: #f5f9ff;
  color: #1565c0;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.dss-table__row--best {
  background: #e8f5e9;
}

.dss-table__row--decrease:not(.dss-table__row--best) {
  background: #fffdf6;
}

.dss-table__row--increase:not(.dss-table__row--best) {
  background: #f7fbff;
}

.dss-table__row--keep:not(.dss-table__row--best) {
  background: #fafafa;
}

.dss-cell-stack {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
}
</style>
