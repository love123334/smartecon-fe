<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { dssApi } from '@/api/services'
import type { PricePredictionApi } from '@/api/real/dss'
import { useAuthStore } from '@/stores/auth'
import { loadSellerCatalogForDss } from '@/utils/sellerCatalog'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import ViDateInput from '@/components/dss/ViDateInput.vue'
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
import DssProfitBreakdownPanel from '@/components/dss/DssProfitBreakdownPanel.vue'
import DssAiInsightCollapsible from '@/components/dss/DssAiInsightCollapsible.vue'
import DssPredictionContextPanel from '@/components/dss/DssPredictionContextPanel.vue'
import DssForecastHolidayScopePanel from '@/components/dss/DssForecastHolidayScopePanel.vue'
import type { CustomPriceScenarioApi } from '@/api/real/dss'

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
const customPriceInput = ref<number | ''>('')
const customScenario = ref<CustomPriceScenarioApi | null>(null)
const customSubmitting = ref(false)
const customError = ref('')
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
  if (result.value.aiInsight?.summary) {
    return {
      backend: result.value.aiInsight,
      structured: null,
    }
  }
  return {
    backend: null,
    structured: buildPricePredictionAiInsight({
      productName: result.value.productName,
      currentPrice: result.value.currentPrice,
      cost: result.value.cost,
      averageElasticity: result.value.averageElasticity,
      totalQuantitySold: result.value.totalQuantitySold,
      best: result.value.bestScenario,
    }),
  }
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
    const sellerKey = auth.user.backendId ?? ''
    const { products: list, error } = await loadSellerCatalogForDss({
      sellerId: sellerKey,
      sellerEmail: auth.user.email,
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

async function onCustomPriceSubmit() {
  if (!result.value || customSubmitting.value) return
  const price = Number(customPriceInput.value)
  if (!Number.isFinite(price) || price <= 0) {
    customError.value = 'Nhập giá bán hợp lệ (VND).'
    return
  }
  customError.value = ''
  customSubmitting.value = true
  try {
    customScenario.value = await dssApi.evaluateCustomPriceScenario({
      productId: result.value.productId,
      fromDate: result.value.fromDate,
      toDate: result.value.toDate,
      customPrice: price,
    })
  } catch (e) {
    customScenario.value = null
    customError.value = mapPricePredictionError(e)
  } finally {
    customSubmitting.value = false
  }
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
        So sánh kịch bản giá theo hệ số co giãn cầu.
      </p>
    </header>

    <!-- 1. Form -->
    <section class="dss-card" aria-labelledby="price-config-title">
      <h2 id="price-config-title" class="dss-card__title">Cấu hình khuyến nghị</h2>

      <LoadingSpinner v-if="productsLoading" size="sm" label="Đang tải sản phẩm" />
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
            <span id="from-label">Từ ngày</span>
            <ViDateInput
              v-model="fromDate"
              :max="toDate || maxToDate"
              :disabled="submitting"
              labelled-by="from-label"
              described-by="from-help from-error"
              :invalid="Boolean(fieldErrors.fromDate)"
              required
            />
            <small id="from-help" class="dss-hint">Ngày bắt đầu khoảng lịch sử giá / bán hàng.</small>
            <small v-if="fieldErrors.fromDate" id="from-error" class="dss-field-error" role="alert">
              {{ fieldErrors.fromDate }}
            </small>
          </label>

          <label class="dss-field">
            <span id="to-label">Đến ngày</span>
            <ViDateInput
              v-model="toDate"
              :min="fromDate || undefined"
              :max="maxToDate"
              :disabled="submitting"
              labelled-by="to-label"
              described-by="to-help to-error"
              :invalid="Boolean(fieldErrors.toDate)"
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
              ? 'Sản phẩm hoặc khoảng thời gian đã đổi. Bấm tạo lại để lấy kịch bản mới.'
              : 'Chọn sản phẩm, khoảng từ ngày–đến ngày rồi bấm “Tạo khuyến nghị giá”.'
          }}
        </p>
      </div>
    </section>

    <template v-if="showResults && result">
      <!-- 2. Input summary -->
      <section class="dss-card" aria-labelledby="price-summary-title">
        <h2 id="price-summary-title" class="dss-card__title">Tóm tắt dữ liệu sản phẩm</h2>
        <p class="dss-meta"><span>Sản phẩm</span>{{ result.productName }}</p>
        <p class="dss-meta"><span>Khoảng thời gian</span>{{ result.fromDate }} → {{ result.toDate }}</p>
        <p v-if="result.historicalPeriodLabel" class="dss-meta"><span>{{ result.historicalPeriodLabel }}</span></p>
        <p v-if="result.scenarioAssumptionNote" class="dss-hint">{{ result.scenarioAssumptionNote }}</p>
        <div class="dss-kpi-grid">
          <article class="dss-kpi">
            <span class="dss-kpi__label">Giá vốn</span>
            <strong>{{ formatVndCurrency(result.cost) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Giá hiện tại</span>
            <strong>{{ formatVndCurrency(result.currentPrice) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Tổng số lượng đã bán</span>
            <strong>{{ formatQuantity(result.totalQuantitySold) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Hệ số co giãn TB</span>
            <strong>{{ formatElasticity(result.averageElasticity) }}</strong>
          </article>
        </div>
      </section>

      <!-- 3. Best recommendation + system judgment -->
      <section
        v-if="result.bestScenario"
        class="dss-card dss-best-card"
        aria-labelledby="price-best-title"
      >
        <div class="dss-best-card__head">
          <h2 id="price-best-title" class="dss-card__title" style="margin: 0">
            Khuyến nghị giá tốt nhất
          </h2>
          <span class="dss-badge dss-badge--best">Khuyến nghị</span>
        </div>
        <div class="dss-kpi-grid dss-kpi-grid--6">
          <article class="dss-kpi dss-kpi--accent">
            <span class="dss-kpi__label">% thay đổi giá</span>
            <strong>{{ formatSignedPercent(result.bestScenario.priceChangePercent) }}</strong>
            <span
              class="dss-badge"
              :class="`dss-badge--${scenarioTone(result.bestScenario.priceChangePercent)}`"
            >
              {{ scenarioToneLabel(scenarioTone(result.bestScenario.priceChangePercent)) }}
            </span>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Giá mới</span>
            <strong>{{ formatVndCurrency(result.bestScenario.newPrice) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Giá vốn</span>
            <strong>{{ formatVndCurrency(result.bestScenario.cost) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Nhu cầu dự báo</span>
            <strong>{{ formatQuantity(result.bestScenario.predictedDemand) }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label" title="Lợi nhuận/sp = Giá mới − Giá vốn">LN / sản phẩm</span>
            <strong>{{ formatVndCurrency(result.bestScenario.profitPerProduct) }}</strong>
          </article>
          <article class="dss-kpi dss-kpi--accent">
            <span class="dss-kpi__label" title="Lợi nhuận kỳ vọng = LN/sp × Nhu cầu dự báo">
              Lợi nhuận kỳ vọng
            </span>
            <strong>{{ formatVndCurrency(result.bestScenario.expectedProfit) }}</strong>
          </article>
        </div>

        <div v-if="result.recommendation" class="dss-recommendation-block">
          <h3 class="dss-system-judgment__title">Khuyến nghị</h3>
          <p>{{ result.recommendation }}</p>
          <p v-if="result.recommendationReason" class="dss-hint">{{ result.recommendationReason }}</p>
        </div>
      </section>

      <DssForecastHolidayScopePanel
        :forecast-from="result.forecastFrom"
        :forecast-to="result.forecastTo"
        :forecast-period-label="result.forecastPeriodLabel"
        :upcoming-holidays="result.upcomingHolidays"
      />

      <DssPredictionContextPanel
        :product-context="result.productContext"
        :price-change-impacts="result.priceChangeImpacts"
      />

      <!-- 4. Scenario table -->
      <section class="dss-card" aria-labelledby="price-table-title">
        <h2 id="price-table-title" class="dss-card__title">So sánh các kịch bản thay đổi giá</h2>

        <div v-if="!scenarios.length" class="dss-empty" role="status">
          <h2>Không có kịch bản</h2>
          <p>Hệ thống trả về danh sách kịch bản rỗng.</p>
        </div>

        <div v-else class="dss-table-wrap" role="region" aria-label="Bảng so sánh kịch bản" tabindex="0">
          <table class="dss-table">
            <thead>
              <tr>
                <th scope="col">% đổi giá</th>
                <th scope="col">Giá vốn</th>
                <th scope="col">Giá mới</th>
                <th scope="col" title="LN/sp = Giá mới − Giá vốn">LN / sp</th>
                <th scope="col">Nhu cầu dự báo</th>
                <th scope="col">Doanh thu kỳ vọng</th>
                <th scope="col" title="Lợi nhuận ròng kỳ vọng">
                  LN ròng kỳ vọng
                </th>
                <th scope="col">Δ LN (%)</th>
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
                      :class="
                        isBestScenarioRow(row, result.bestScenario)
                          ? 'dss-badge--best'
                          : `dss-badge--${scenarioTone(row.priceChangePercent)}`
                      "
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
                <td>{{ formatVndCurrency(row.expectedRevenue ?? row.newPrice * row.predictedDemand) }}</td>
                <td>
                  <strong>{{ formatVndCurrency(row.expectedProfit) }}</strong>
                </td>
                <td>{{ row.profitChangePercent != null ? `${row.profitChangePercent}%` : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 5. Custom price scenario -->
      <section class="dss-card" aria-labelledby="price-custom-title">
        <h2 id="price-custom-title" class="dss-card__title">Kịch bản giá tùy chỉnh</h2>
        <p class="dss-hint">
          Nhập giá bán bạn muốn thử — hệ thống tính nhu cầu, doanh thu và lợi nhuận ròng tương ứng.
        </p>
        <form class="dss-form dss-form--inline" @submit.prevent="onCustomPriceSubmit">
          <label class="dss-field">
            <span>Giá thử nghiệm (VND)</span>
            <input
              v-model.number="customPriceInput"
              type="number"
              min="1"
              step="1000"
              class="dss-input"
              :placeholder="String(result.currentPrice)"
              :disabled="customSubmitting"
            />
          </label>
          <button
            type="submit"
            class="dss-btn dss-btn--outline"
            :disabled="customSubmitting"
            :aria-busy="customSubmitting"
          >
            {{ customSubmitting ? 'Đang tính…' : 'Xem kịch bản' }}
          </button>
        </form>
        <p v-if="customError" class="dss-alert dss-alert--warn" role="alert">{{ customError }}</p>
        <template v-if="customScenario">
          <p class="dss-recommendation-block">{{ customScenario.recommendation }}</p>
          <p class="dss-hint">{{ customScenario.recommendationReason }}</p>
          <p class="dss-meta">
            <span>Giá hiện tại</span>{{ formatVndCurrency(customScenario.currentPrice) }}
            → <strong>{{ formatVndCurrency(customScenario.customPrice) }}</strong>
            ({{ customScenario.derivedPriceChangePercent > 0 ? '+' : '' }}{{ customScenario.derivedPriceChangePercent }}%)
          </p>
          <div class="dss-kpi-grid">
            <article class="dss-kpi">
              <span class="dss-kpi__label">Nhu cầu dự báo</span>
              <strong>{{ formatQuantity(customScenario.scenario.predictedDemand) }}</strong>
            </article>
            <article class="dss-kpi">
              <span class="dss-kpi__label">Doanh thu kỳ vọng</span>
              <strong>{{ formatVndCurrency(customScenario.scenario.expectedRevenue ?? 0) }}</strong>
            </article>
            <article class="dss-kpi dss-kpi--accent">
              <span class="dss-kpi__label">LN ròng kỳ vọng</span>
              <strong>{{ formatVndCurrency(customScenario.scenario.expectedProfit) }}</strong>
            </article>
          </div>
          <DssProfitBreakdownPanel
            title="Chi tiết lợi nhuận — giá tùy chỉnh"
            :breakdown="customScenario.scenario.profitBreakdown"
          />
        </template>
      </section>

      <DssAiInsightCollapsible
        v-if="aiInsight"
        label="Nhận định AI · Khuyến nghị giá"
        :backend="aiInsight.backend"
        :structured="aiInsight.structured"
      />
    </template>
  </div>
</template>

<style scoped>
.dss-recommendation-block {
  font-weight: 600;
  color: #0f766e;
  margin: 0.75rem 0 0.35rem;
  line-height: 1.45;
}
.dss-form--inline {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: flex-end;
  margin-top: 0.75rem;
}
.dss-form--inline .dss-field {
  flex: 1;
  min-width: 200px;
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
  background: #e3f2fd;
  color: #1565c0;
  border-color: #90caf9;
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
  background: #e8f5e9;
  color: #1b5e20;
  border-color: #a5d6a7;
}

.dss-system-judgment {
  margin-top: 1.15rem;
  padding-top: 1rem;
  border-top: 1px solid #c8e6c9;
}

.dss-system-judgment__title {
  margin: 0 0 0.45rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: #1b5e20;
}

.dss-system-judgment__text {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.55;
  color: #263238;
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
  background: #f1f8f4;
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
