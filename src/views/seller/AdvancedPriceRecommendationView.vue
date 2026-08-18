<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  applyAdvancedPriceScenario,
  createAdvancedPriceScenario,
  createAdvancedPriceSession,
  getAdvancedPriceSession,
  type AdvancedPriceScenarioApi,
  type AdvancedPriceSessionApi,
} from '@/api/real/dss'
import { listProducts } from '@/api/real/products'
import { useAuthStore } from '@/stores/auth'
import {
  ADVANCED_PRICE_CHANGE_MAX,
  ADVANCED_PRICE_CHANGE_MIN,
  ADVANCED_PRICE_CHANGE_STEP,
  ADVANCED_PRICE_FORECAST_PERIODS,
  advancedPriceDateDefaults,
  formatForecastMethod,
  formatNumber,
  formatSignedPercent,
  formatVnd,
  mapAdvancedPriceError,
  todayIsoDate,
  validateAdvancedPriceChange,
  validateAdvancedPriceForm,
  type AdvancedPriceFieldErrors,
} from '@/utils/advancedPrice'

interface SellerProductOption {
  id: number
  name: string
}

const auth = useAuthStore()
const dateDefaults = advancedPriceDateDefaults()

const products = ref<SellerProductOption[]>([])
const productsLoading = ref(false)
const productsError = ref('')

const productId = ref<number | ''>('')
const fromDate = ref(dateDefaults.fromDate)
const toDate = ref(dateDefaults.toDate)
const forecastPeriod = ref<7 | 14 | 30>(14)
const estimatedOrderCost = ref<number | null>(0)
const priceChangePercent = ref(-10)
const maxToDate = todayIsoDate()

const session = ref<AdvancedPriceSessionApi | null>(null)
const fieldErrors = ref<AdvancedPriceFieldErrors>({})
const submitting = ref(false)
const restoring = ref(false)
const submitError = ref('')
const successMessage = ref('')
const pendingApply = ref<AdvancedPriceScenarioApi | null>(null)
const applyingScenarioId = ref<number | null>(null)

const sellerId = computed(() => {
  const raw = auth.user?.backendId ?? auth.user?.id
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : null
})

const storageKey = computed(() =>
  sellerId.value ? `sedsp_advanced_price_session_${sellerId.value}` : '',
)

const selectedProduct = computed(() =>
  products.value.find((product) => product.id === productId.value) ?? null,
)
const fixedInputsLocked = computed(() => session.value !== null)
const sessionApplied = computed(() => session.value?.status === 'APPLIED')
const latestScenario = computed(() => session.value?.latestScenario ?? null)
const scenarios = computed(() => session.value?.scenarios ?? [])
const canSubmit = computed(
  () =>
    !submitting.value &&
    !restoring.value &&
    !productsLoading.value &&
    products.value.length > 0 &&
    !sessionApplied.value,
)
const changeDescription = computed(() => {
  const value = priceChangePercent.value
  if (value < 0) return `Giảm ${formatNumber(Math.abs(value))}% so với giá hiện tại`
  if (value > 0) return `Tăng ${formatNumber(value)}% so với giá hiện tại`
  return 'Giữ nguyên giá hiện tại'
})
const sliderPosition = computed(
  () =>
    ((priceChangePercent.value - ADVANCED_PRICE_CHANGE_MIN) /
      (ADVANCED_PRICE_CHANGE_MAX - ADVANCED_PRICE_CHANGE_MIN)) *
    100,
)

onMounted(async () => {
  await loadSellerProducts()
  await restoreSession()
})

async function loadSellerProducts() {
  productsLoading.value = true
  productsError.value = ''
  try {
    if (!sellerId.value) {
      throw new Error('Không xác định được Seller ID từ phiên đăng nhập backend.')
    }
    const backendProducts = await listProducts({ sellerId: sellerId.value, size: 100 })
    products.value = backendProducts
      .map((product) => ({ id: Number(product.id), name: product.name }))
      .filter((product) => Number.isInteger(product.id) && product.id > 0)

    if (!products.value.length) {
      productId.value = ''
      productsError.value = 'Backend chưa trả về sản phẩm nào thuộc Seller hiện tại.'
      return
    }
    if (!products.value.some((product) => product.id === productId.value)) {
      productId.value = products.value[0]?.id ?? ''
    }
  } catch (error) {
    products.value = []
    productId.value = ''
    productsError.value = mapAdvancedPriceError(error)
  } finally {
    productsLoading.value = false
  }
}

async function restoreSession() {
  if (!storageKey.value) return
  const rawId = window.sessionStorage.getItem(storageKey.value)
  const sessionId = Number(rawId)
  if (!Number.isInteger(sessionId) || sessionId <= 0) return

  restoring.value = true
  try {
    const restored = await getAdvancedPriceSession(sessionId)
    setSession(restored)
  } catch {
    window.sessionStorage.removeItem(storageKey.value)
  } finally {
    restoring.value = false
  }
}

function setSession(value: AdvancedPriceSessionApi) {
  session.value = value
  const summary = value.productSummary
  productId.value = summary.productId
  fromDate.value = summary.fromDate
  toDate.value = summary.toDate
  forecastPeriod.value = summary.forecastPeriod as 7 | 14 | 30
  estimatedOrderCost.value = summary.estimatedOrderCost
  if (storageKey.value) {
    window.sessionStorage.setItem(storageKey.value, String(value.sessionId))
  }
}

async function createScenario() {
  if (!canSubmit.value) return
  fieldErrors.value = {}
  submitError.value = ''
  successMessage.value = ''

  const priceError = validateAdvancedPriceChange(priceChangePercent.value)
  if (priceError) {
    fieldErrors.value.priceChangePercent = priceError
    return
  }

  submitting.value = true
  try {
    let activeSession = session.value
    if (!activeSession) {
      const validation = validateAdvancedPriceForm({
        productId: productId.value,
        fromDate: fromDate.value,
        toDate: toDate.value,
        forecastPeriod: forecastPeriod.value,
        estimatedOrderCost: estimatedOrderCost.value,
      })
      if (!validation.ok) {
        fieldErrors.value = validation.errors
        return
      }
      activeSession = await createAdvancedPriceSession(validation.payload)
      setSession(activeSession)
    }

    const updated = await createAdvancedPriceScenario(activeSession.sessionId, {
      priceChangePercent: priceChangePercent.value,
    })
    setSession(updated)
    successMessage.value = `Đã tạo kịch bản ${formatSignedPercent(priceChangePercent.value)} từ dữ liệu Backend.`
  } catch (error) {
    submitError.value = mapAdvancedPriceError(error)
  } finally {
    submitting.value = false
  }
}

function startNewSession() {
  if (storageKey.value) window.sessionStorage.removeItem(storageKey.value)
  session.value = null
  pendingApply.value = null
  submitError.value = ''
  successMessage.value = ''
  fieldErrors.value = {}
}

function askApply(scenario: AdvancedPriceScenarioApi) {
  if (sessionApplied.value || applyingScenarioId.value !== null) return
  pendingApply.value = scenario
}

async function confirmApply() {
  if (!session.value || !pendingApply.value || applyingScenarioId.value !== null) return
  const scenario = pendingApply.value
  applyingScenarioId.value = scenario.scenarioId
  submitError.value = ''
  successMessage.value = ''
  try {
    await applyAdvancedPriceScenario(session.value.sessionId, scenario.scenarioId)
    const refreshed = await getAdvancedPriceSession(session.value.sessionId)
    setSession(refreshed)
    successMessage.value = `Đã cập nhật giá sản phẩm thành ${formatVnd(scenario.newPrice)}.`
    pendingApply.value = null
    await loadSellerProducts()
  } catch (error) {
    submitError.value = mapAdvancedPriceError(error)
  } finally {
    applyingScenarioId.value = null
  }
}

function formatDate(value: string): string {
  if (!value) return '—'
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN')
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function elasticityLabel(source: string): string {
  return source === 'SELECTED_RANGE'
    ? 'Tính trong khoảng đã chọn'
    : source === 'ALL_HISTORY_FALLBACK'
      ? 'Dùng toàn bộ lịch sử giá'
      : source
}

function scenarioClass(change: number): string {
  if (change < 0) return 'advanced-change--down'
  if (change > 0) return 'advanced-change--up'
  return 'advanced-change--flat'
}
</script>

<template>
  <div class="dss-page advanced-price-page">
    <header class="dss-page__header advanced-header">
      <nav class="dss-crumb" aria-label="Breadcrumb">
        <RouterLink to="/seller/products">Bảng điều khiển người bán</RouterLink>
        <span>/</span>
        <RouterLink to="/seller/dss">DSS</RouterLink>
        <span>/</span>
        <span>Gợi ý Giá bán</span>
      </nav>
      <div class="advanced-header__content">
        <div>
          <span class="advanced-eyebrow">LightGBM × Hệ số co giãn E</span>
          <h1>Gợi ý Giá bán</h1>
          <p class="dss-page__sub">
            Mô phỏng thay đổi giá, nhu cầu và lợi nhuận trên cùng một bộ dữ liệu lịch sử.
          </p>
        </div>
        <div class="advanced-source-chip" title="Trang này không sử dụng mock hoặc dữ liệu sản phẩm cứng">
          <span class="advanced-source-chip__dot" aria-hidden="true"></span>
          Dữ liệu trực tiếp từ Backend
        </div>
      </div>
    </header>

    <div v-if="restoring" class="dss-alert advanced-info" role="status">
      Đang khôi phục phiên phân tích gần nhất từ Backend…
    </div>

    <section class="dss-card advanced-config" aria-labelledby="advanced-config-title">
      <div class="advanced-section-head">
        <div>
          <span class="advanced-step">01 · Thiết lập</span>
          <h2 id="advanced-config-title" class="dss-card__title">Cấu hình kịch bản giá</h2>
        </div>
        <span v-if="fixedInputsLocked" class="advanced-lock-badge">
          <span aria-hidden="true">●</span> Thông số đã khóa theo phiên
        </span>
      </div>

      <p v-if="productsLoading" class="dss-hint" role="status">Đang tải sản phẩm từ Backend…</p>
      <div v-else-if="productsError" class="dss-alert dss-alert--warn" role="alert">
        {{ productsError }}
      </div>

      <form @submit.prevent="createScenario">
        <div class="advanced-form-grid">
          <label class="dss-field advanced-field--product">
            <span>Sản phẩm đang bán</span>
            <select
              v-model.number="productId"
              class="dss-input"
              :disabled="fixedInputsLocked || productsLoading || !products.length"
              :aria-invalid="Boolean(fieldErrors.productId)"
              required
            >
              <option disabled value="">— Chọn sản phẩm từ Backend —</option>
              <option v-for="product in products" :key="product.id" :value="product.id">
                {{ product.name }}
              </option>
            </select>
            <small v-if="selectedProduct" class="advanced-selected-product">
              {{ selectedProduct.name }}
            </small>
            <small v-if="fieldErrors.productId" class="advanced-error">{{ fieldErrors.productId }}</small>
          </label>

          <label class="dss-field">
            <span>Từ ngày</span>
            <input
              v-model="fromDate"
              type="date"
              class="dss-input"
              :max="toDate || maxToDate"
              :disabled="fixedInputsLocked"
              :aria-invalid="Boolean(fieldErrors.fromDate)"
              required
            />
            <small v-if="fieldErrors.fromDate" class="advanced-error">{{ fieldErrors.fromDate }}</small>
          </label>

          <label class="dss-field">
            <span>Đến ngày</span>
            <input
              v-model="toDate"
              type="date"
              class="dss-input"
              :min="fromDate || undefined"
              :max="maxToDate"
              :disabled="fixedInputsLocked"
              :aria-invalid="Boolean(fieldErrors.toDate)"
              required
            />
            <small v-if="fieldErrors.toDate" class="advanced-error">{{ fieldErrors.toDate }}</small>
          </label>

          <label class="dss-field">
            <span>Khoảng dự báo</span>
            <select
              v-model.number="forecastPeriod"
              class="dss-input"
              :disabled="fixedInputsLocked"
              :aria-invalid="Boolean(fieldErrors.forecastPeriod)"
            >
              <option v-for="days in ADVANCED_PRICE_FORECAST_PERIODS" :key="days" :value="days">
                {{ days }} ngày
              </option>
            </select>
            <small v-if="fieldErrors.forecastPeriod" class="advanced-error">
              {{ fieldErrors.forecastPeriod }}
            </small>
          </label>

          <label class="dss-field advanced-field--cost">
            <span>Chi phí trên 1 đơn hàng</span>
            <div class="advanced-money-input">
              <input
                v-model.number="estimatedOrderCost"
                type="number"
                min="0"
                step="1000"
                class="dss-input"
                inputmode="decimal"
                :disabled="fixedInputsLocked"
                :aria-invalid="Boolean(fieldErrors.estimatedOrderCost)"
                required
              />
              <span>₫</span>
            </div>
            <small class="dss-hint">Được trừ khi tính lợi nhuận trên mỗi sản phẩm.</small>
            <small v-if="fieldErrors.estimatedOrderCost" class="advanced-error">
              {{ fieldErrors.estimatedOrderCost }}
            </small>
          </label>
        </div>

        <div class="advanced-slider-panel">
          <div class="advanced-slider-head">
            <div>
              <span class="advanced-slider-label">% thay đổi giá</span>
              <strong :class="scenarioClass(priceChangePercent)">
                {{ formatSignedPercent(priceChangePercent) }}
              </strong>
            </div>
            <p>{{ changeDescription }}</p>
          </div>
          <input
            v-model.number="priceChangePercent"
            type="range"
            class="advanced-slider"
            :min="ADVANCED_PRICE_CHANGE_MIN"
            :max="ADVANCED_PRICE_CHANGE_MAX"
            :step="ADVANCED_PRICE_CHANGE_STEP"
            :disabled="sessionApplied"
            :aria-valuemin="ADVANCED_PRICE_CHANGE_MIN"
            :aria-valuemax="ADVANCED_PRICE_CHANGE_MAX"
            :aria-valuenow="priceChangePercent"
            :aria-valuetext="changeDescription"
          />
          <div class="advanced-slider-scale" aria-hidden="true">
            <span>-70%</span>
            <span :style="{ left: `${sliderPosition}%` }" class="advanced-slider-scale__current">
              {{ formatSignedPercent(priceChangePercent) }}
            </span>
            <span>+100%</span>
          </div>
          <small v-if="fieldErrors.priceChangePercent" class="advanced-error">
            {{ fieldErrors.priceChangePercent }}
          </small>
        </div>

        <div class="advanced-actions">
          <button type="submit" class="dss-btn dss-btn--primary" :disabled="!canSubmit">
            {{ submitting ? 'Đang phân tích…' : 'Tạo kịch bản giá' }}
          </button>
          <button
            v-if="session"
            type="button"
            class="dss-btn dss-btn--outline"
            :disabled="submitting || applyingScenarioId !== null"
            @click="startNewSession"
          >
            Tạo phiên mới
          </button>
          <span v-if="session && !sessionApplied" class="advanced-counter">
            {{ session.scenarioCount }}/{{ session.maxScenarios }} kịch bản gần nhất
          </span>
        </div>
      </form>

      <div v-if="submitError" class="dss-alert dss-alert--warn advanced-feedback" role="alert">
        {{ submitError }}
      </div>
      <div v-if="successMessage" class="dss-alert dss-alert--success advanced-feedback" role="status">
        {{ successMessage }}
      </div>
      <div v-if="sessionApplied" class="advanced-applied-banner" role="status">
        <strong>Phiên đã áp dụng giá</strong>
        <span>{{ formatDateTime(session?.appliedAt ?? null) }}</span>
        <small>Hãy tạo phiên mới nếu muốn tiếp tục mô phỏng trên giá hiện tại mới.</small>
      </div>
    </section>

    <template v-if="session">
      <section class="dss-card" aria-labelledby="advanced-summary-title">
        <div class="advanced-section-head">
          <div>
            <span class="advanced-step">02 · Dữ liệu đầu vào</span>
            <h2 id="advanced-summary-title" class="dss-card__title">Tóm tắt dữ liệu sản phẩm</h2>
          </div>
          <span class="advanced-session-id">Phiên #{{ session.sessionId }}</span>
        </div>

        <div class="advanced-product-summary">
          <div class="advanced-product-summary__identity">
            <span>Sản phẩm</span>
            <strong>{{ session.productSummary.productName }}</strong>
            <small>
              {{ formatDate(session.productSummary.fromDate) }} →
              {{ formatDate(session.productSummary.toDate) }} · dự báo
              {{ session.productSummary.forecastPeriod }} ngày
            </small>
          </div>
          <div class="advanced-summary-grid">
            <article>
              <span>Giá hiện tại</span>
              <strong>{{ formatVnd(session.productSummary.currentPrice) }}</strong>
            </article>
            <article>
              <span>Giá vốn</span>
              <strong>{{ formatVnd(session.productSummary.costPrice) }}</strong>
            </article>
            <article>
              <span>Chi phí ước tính</span>
              <strong>{{ formatVnd(session.productSummary.estimatedOrderCost) }}</strong>
            </article>
            <article>
              <span>Số lượng đã bán</span>
              <strong>{{ formatNumber(session.productSummary.historicalQuantitySold) }}</strong>
            </article>
          </div>
        </div>

        <div class="advanced-model-meta">
          <span>
            <small>Mô hình nhu cầu</small>
            <strong>{{ formatForecastMethod(session.forecastMethod) }}</strong>
          </span>
          <span>
            <small>Hệ số co giãn E</small>
            <strong>{{ formatNumber(session.averageElasticity) }}</strong>
            <em>{{ elasticityLabel(session.elasticitySource) }}</em>
          </span>
          <span>
            <small>Nhu cầu nền</small>
            <strong>{{ formatNumber(session.baselineForecastDemand) }}</strong>
            <em>{{ session.productSummary.forecastPeriod }} ngày</em>
          </span>
        </div>
      </section>

      <section v-if="latestScenario" class="dss-card advanced-detail" aria-labelledby="advanced-detail-title">
        <div class="advanced-section-head">
          <div>
            <span class="advanced-step">03 · Phân tích hiện tại</span>
            <h2 id="advanced-detail-title" class="dss-card__title">Chi tiết số liệu chuyên sâu</h2>
          </div>
          <span class="advanced-detail__time">{{ formatDateTime(latestScenario.createdAt) }}</span>
        </div>

        <div class="advanced-detail-grid">
          <article class="advanced-detail-card advanced-detail-card--change">
            <span>% thay đổi giá</span>
            <strong :class="scenarioClass(latestScenario.priceChangePercent)">
              {{ formatSignedPercent(latestScenario.priceChangePercent) }}
            </strong>
            <small>{{ formatVnd(session.productSummary.currentPrice) }} → {{ formatVnd(latestScenario.newPrice) }}</small>
          </article>
          <article class="advanced-detail-card">
            <span>Nhu cầu dự báo</span>
            <strong>{{ formatNumber(latestScenario.forecastDemand) }}</strong>
            <small>
              Nền {{ formatNumber(latestScenario.baselineForecastDemand) }} ×
              {{ formatNumber(latestScenario.demandMultiplier) }}
            </small>
          </article>
          <article class="advanced-detail-card" :class="{ 'advanced-detail-card--negative': latestScenario.profitPerProduct < 0 }">
            <span>Lợi nhuận / sản phẩm</span>
            <strong>{{ formatVnd(latestScenario.profitPerProduct) }}</strong>
            <small>Giá mới − giá vốn − chi phí</small>
          </article>
          <article class="advanced-detail-card advanced-detail-card--profit" :class="{ 'advanced-detail-card--negative': latestScenario.expectedProfit < 0 }">
            <span>Lợi nhuận kỳ vọng</span>
            <strong>{{ formatVnd(latestScenario.expectedProfit) }}</strong>
            <small>Nhu cầu dự báo × LN / sản phẩm</small>
          </article>
        </div>
      </section>

      <section class="dss-card" aria-labelledby="advanced-table-title">
        <div class="advanced-section-head">
          <div>
            <span class="advanced-step">04 · Quyết định</span>
            <h2 id="advanced-table-title" class="dss-card__title">So sánh 5 kịch bản gần nhất</h2>
          </div>
          <span class="advanced-counter">{{ scenarios.length }}/{{ session.maxScenarios }}</span>
        </div>

        <div v-if="!scenarios.length" class="dss-empty">
          <div class="dss-empty__art" aria-hidden="true">◇</div>
          <h2>Chưa có kịch bản</h2>
          <p>Chọn phần trăm đổi giá và bấm “Tạo kịch bản giá”.</p>
        </div>

        <div v-else class="dss-table-wrap advanced-table-wrap" tabindex="0">
          <table class="dss-table advanced-table">
            <thead>
              <tr>
                <th>% đổi giá</th>
                <th>Giá vốn</th>
                <th>Giá mới</th>
                <th>LN / SP</th>
                <th>Nhu cầu dự báo</th>
                <th>LN kỳ vọng</th>
                <th>Thực thi</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="scenario in scenarios"
                :key="scenario.scenarioId"
                :class="{ 'advanced-table__latest': scenario.scenarioId === latestScenario?.scenarioId }"
              >
                <td>
                  <strong :class="scenarioClass(scenario.priceChangePercent)">
                    {{ formatSignedPercent(scenario.priceChangePercent) }}
                  </strong>
                </td>
                <td>{{ formatVnd(scenario.costPrice) }}</td>
                <td><strong>{{ formatVnd(scenario.newPrice) }}</strong></td>
                <td :class="{ 'advanced-negative': scenario.profitPerProduct < 0 }">
                  {{ formatVnd(scenario.profitPerProduct) }}
                </td>
                <td>{{ formatNumber(scenario.forecastDemand) }}</td>
                <td :class="{ 'advanced-negative': scenario.expectedProfit < 0 }">
                  <strong>{{ formatVnd(scenario.expectedProfit) }}</strong>
                </td>
                <td>
                  <span v-if="scenario.applied" class="advanced-applied-chip">Đã áp dụng</span>
                  <button
                    v-else
                    type="button"
                    class="advanced-apply-btn"
                    :disabled="sessionApplied || applyingScenarioId !== null"
                    @click="askApply(scenario)"
                  >
                    {{ applyingScenarioId === scenario.scenarioId ? 'Đang cập nhật…' : 'Áp dụng giá' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <section v-else-if="!restoring" class="dss-card advanced-empty-state">
      <div class="advanced-empty-state__icon" aria-hidden="true">↗</div>
      <div>
        <h2>Chưa có phiên phân tích</h2>
        <p>
          Các chỉ số chỉ xuất hiện sau khi Backend trả kết quả. Trang này không tự sinh số liệu mẫu.
        </p>
      </div>
    </section>

    <div v-if="pendingApply" class="advanced-dialog-backdrop" @click.self="pendingApply = null">
      <section class="advanced-dialog" role="dialog" aria-modal="true" aria-labelledby="apply-dialog-title">
        <span class="advanced-dialog__eyebrow">Xác nhận thay đổi dữ liệu</span>
        <h2 id="apply-dialog-title">Áp dụng giá mới cho sản phẩm?</h2>
        <p>
          Giá bán sẽ thay đổi từ
          <strong>{{ formatVnd(session?.productSummary.currentPrice ?? 0) }}</strong>
          thành <strong>{{ formatVnd(pendingApply.newPrice) }}</strong> trong database.
        </p>
        <div class="advanced-dialog__metrics">
          <span>% đổi giá <strong>{{ formatSignedPercent(pendingApply.priceChangePercent) }}</strong></span>
          <span>LN kỳ vọng <strong>{{ formatVnd(pendingApply.expectedProfit) }}</strong></span>
        </div>
        <div class="advanced-dialog__actions">
          <button type="button" class="dss-btn dss-btn--outline" :disabled="applyingScenarioId !== null" @click="pendingApply = null">
            Hủy
          </button>
          <button type="button" class="dss-btn dss-btn--primary" :disabled="applyingScenarioId !== null" @click="confirmApply">
            {{ applyingScenarioId !== null ? 'Đang cập nhật…' : 'Xác nhận áp dụng' }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.advanced-price-page {
  max-width: 1240px;
}

.advanced-header {
  padding: 0.35rem 0 0.4rem;
}

.advanced-header__content,
.advanced-section-head,
.advanced-actions,
.advanced-slider-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.advanced-eyebrow,
.advanced-step,
.advanced-dialog__eyebrow {
  display: inline-block;
  color: #0f766e;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.advanced-source-chip,
.advanced-lock-badge,
.advanced-session-id,
.advanced-counter {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  padding: 0.42rem 0.72rem;
  border-radius: 999px;
  border: 1px solid #b7e4dc;
  background: #f0fdfa;
  color: #0f766e;
  font-size: 0.76rem;
  font-weight: 750;
  white-space: nowrap;
}

.advanced-source-chip__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.12);
}

.advanced-config {
  border-top: 3px solid #0f766e;
}

.advanced-section-head {
  align-items: flex-start;
  margin-bottom: 1rem;
}

.advanced-section-head .dss-card__title {
  margin: 0.22rem 0 0;
}

.advanced-lock-badge {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
}

.advanced-form-grid {
  display: grid;
  grid-template-columns: 1.5fr repeat(3, minmax(145px, 0.75fr));
  gap: 0.9rem;
  align-items: start;
}

.advanced-field--cost {
  grid-column: span 2;
}

.advanced-selected-product {
  color: #0f766e;
  font-size: 0.78rem;
  font-weight: 650;
}

.advanced-money-input {
  position: relative;
}

.advanced-money-input .dss-input {
  width: 100%;
  padding-right: 2.2rem;
  box-sizing: border-box;
}

.advanced-money-input > span {
  position: absolute;
  top: 50%;
  right: 0.8rem;
  transform: translateY(-50%);
  color: #64748b;
  font-weight: 700;
}

.advanced-error {
  color: #b91c1c;
  font-size: 0.78rem;
  line-height: 1.4;
}

.advanced-slider-panel {
  margin-top: 1rem;
  padding: 1rem 1.1rem 0.9rem;
  border: 1px solid #dbe7e5;
  border-radius: 12px;
  background: linear-gradient(135deg, #f8fffd, #f8fafc);
}

.advanced-slider-head > div {
  display: flex;
  align-items: baseline;
  gap: 0.65rem;
}

.advanced-slider-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: #475569;
}

.advanced-slider-head strong {
  font-size: 1.5rem;
}

.advanced-slider-head p {
  margin: 0;
  color: #64748b;
  font-size: 0.84rem;
}

.advanced-slider {
  width: 100%;
  height: 0.5rem;
  margin-top: 0.8rem;
  accent-color: #0f766e;
  cursor: pointer;
}

.advanced-slider-scale {
  position: relative;
  display: flex;
  justify-content: space-between;
  margin-top: 0.3rem;
  color: #64748b;
  font-size: 0.72rem;
}

.advanced-slider-scale__current {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  color: #0f766e;
  font-weight: 800;
}

.advanced-actions {
  justify-content: flex-start;
  margin-top: 1rem;
}

.advanced-actions .advanced-counter {
  margin-left: auto;
}

.advanced-feedback {
  margin: 1rem 0 0;
}

.advanced-info {
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
}

.advanced-applied-banner {
  display: grid;
  grid-template-columns: auto auto 1fr;
  gap: 0.5rem 1rem;
  align-items: center;
  margin-top: 1rem;
  padding: 0.8rem 1rem;
  border-radius: 10px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #065f46;
}

.advanced-applied-banner small {
  text-align: right;
}

.advanced-product-summary {
  display: grid;
  grid-template-columns: minmax(220px, 1.1fr) 2fr;
  gap: 1rem;
}

.advanced-product-summary__identity {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 1rem 1.1rem;
  border-radius: 12px;
  background: #0f172a;
  color: #fff;
}

.advanced-product-summary__identity span,
.advanced-summary-grid span,
.advanced-detail-card > span {
  color: #94a3b8;
  font-size: 0.7rem;
  font-weight: 750;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.advanced-product-summary__identity strong {
  margin: 0.35rem 0;
  font-size: 1.05rem;
  line-height: 1.4;
}

.advanced-product-summary__identity small {
  color: #cbd5e1;
}

.advanced-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.advanced-summary-grid article {
  padding: 0.85rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.advanced-summary-grid strong {
  display: block;
  margin-top: 0.32rem;
  color: #0f172a;
  font-size: 1.05rem;
}

.advanced-model-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.7rem;
  margin-top: 0.8rem;
}

.advanced-model-meta > span {
  display: grid;
  gap: 0.2rem;
  padding: 0.7rem 0.85rem;
  border-left: 3px solid #5eead4;
  background: #f8fafc;
}

.advanced-model-meta small,
.advanced-model-meta em {
  color: #64748b;
  font-size: 0.72rem;
  font-style: normal;
}

.advanced-detail {
  background: linear-gradient(150deg, #ffffff 45%, #f0fdfa);
}

.advanced-detail__time {
  color: #64748b;
  font-size: 0.76rem;
}

.advanced-detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.advanced-detail-card {
  min-height: 112px;
  padding: 1rem;
  border: 1px solid #dfe7e5;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
}

.advanced-detail-card strong {
  display: block;
  margin: 0.45rem 0 0.3rem;
  color: #0f172a;
  font-size: 1.35rem;
}

.advanced-detail-card small {
  color: #64748b;
  line-height: 1.4;
}

.advanced-detail-card--profit {
  border-color: #86efac;
  background: #f0fdf4;
}

.advanced-detail-card--profit strong {
  color: #166534;
}

.advanced-detail-card--negative {
  border-color: #fecaca;
  background: #fff7f7;
}

.advanced-detail-card--negative strong,
.advanced-negative {
  color: #b91c1c !important;
}

.advanced-change--down {
  color: #dc2626 !important;
}

.advanced-change--up {
  color: #047857 !important;
}

.advanced-change--flat {
  color: #475569 !important;
}

.advanced-table-wrap {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.advanced-table {
  min-width: 980px;
}

.advanced-table td:last-child,
.advanced-table th:last-child {
  text-align: right;
}

.advanced-table__latest {
  background: #f0fdfa;
}

.advanced-apply-btn {
  padding: 0.45rem 0.7rem;
  border: 1px solid #0f766e;
  border-radius: 7px;
  background: #fff;
  color: #0f766e;
  font: inherit;
  font-size: 0.76rem;
  font-weight: 750;
  cursor: pointer;
}

.advanced-apply-btn:hover:not(:disabled) {
  background: #0f766e;
  color: #fff;
}

.advanced-apply-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.advanced-applied-chip {
  display: inline-block;
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  background: #dcfce7;
  color: #166534;
  font-size: 0.72rem;
  font-weight: 750;
}

.advanced-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  min-height: 150px;
  border-style: dashed;
}

.advanced-empty-state__icon {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: #ccfbf1;
  color: #0f766e;
  font-size: 1.5rem;
}

.advanced-empty-state h2,
.advanced-empty-state p {
  margin: 0;
}

.advanced-empty-state h2 {
  color: #0f172a;
  font-size: 1.05rem;
}

.advanced-empty-state p {
  margin-top: 0.35rem;
  color: #64748b;
}

.advanced-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(3px);
}

.advanced-dialog {
  width: min(480px, 100%);
  padding: 1.35rem;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25);
}

.advanced-dialog h2 {
  margin: 0.35rem 0 0.65rem;
  color: #0f172a;
  font-size: 1.25rem;
}

.advanced-dialog p {
  margin: 0;
  color: #475569;
  line-height: 1.55;
}

.advanced-dialog__metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
  margin: 1rem 0;
}

.advanced-dialog__metrics span {
  display: grid;
  gap: 0.25rem;
  padding: 0.7rem;
  border-radius: 9px;
  background: #f8fafc;
  color: #64748b;
  font-size: 0.75rem;
}

.advanced-dialog__metrics strong {
  color: #0f172a;
  font-size: 0.95rem;
}

.advanced-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.65rem;
}

@media (max-width: 980px) {
  .advanced-form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .advanced-field--product,
  .advanced-field--cost {
    grid-column: span 2;
  }

  .advanced-detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .advanced-header__content,
  .advanced-section-head,
  .advanced-slider-head,
  .advanced-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .advanced-form-grid,
  .advanced-product-summary,
  .advanced-summary-grid,
  .advanced-model-meta,
  .advanced-detail-grid,
  .advanced-dialog__metrics {
    grid-template-columns: 1fr;
  }

  .advanced-field--product,
  .advanced-field--cost {
    grid-column: span 1;
  }

  .advanced-actions .advanced-counter {
    margin-left: 0;
  }

  .advanced-applied-banner {
    grid-template-columns: 1fr;
  }

  .advanced-applied-banner small {
    text-align: left;
  }
}
</style>
