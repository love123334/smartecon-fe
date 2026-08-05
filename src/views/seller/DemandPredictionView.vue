<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { dssApi } from '@/api/services'
import type { DemandPredictionApi } from '@/api/real/dss'
import { useAuthStore } from '@/stores/auth'
import { loadSellerCatalogForDss } from '@/utils/sellerCatalog'
import {
  FORECAST_PERIOD_OPTIONS,
  HISTORICAL_DAYS_OPTIONS,
  formatViDateTime,
  formatViNumber,
  mapDemandPredictionError,
  validateDemandPredictionForm,
} from '@/utils/demandPrediction'

interface SellerProductOption {
  id: number
  name: string
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
        <span>Dự báo nhu cầu</span>
      </nav>
      <h1>Dự báo nhu cầu</h1>
      <p class="dss-page__sub">
        Tạo dự báo nhu cầu sản phẩm từ lịch sử bán hàng.
      </p>
    </header>

    <div class="dss-two-col">
      <section class="dss-card" aria-labelledby="demand-config-title">
        <h2 id="demand-config-title" class="dss-card__title">Cấu hình dự báo</h2>

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
                Chỉ hiển thị sản phẩm thuộc tài khoản Seller hiện tại.
              </small>
              <small v-if="selectedProduct" class="dss-selected-name">
                Đã chọn: <strong>{{ selectedProduct.name }}</strong>
              </small>
              <small v-if="fieldErrors.productId" id="product-error" class="dss-field-error" role="alert">
                {{ fieldErrors.productId }}
              </small>
            </label>

            <label class="dss-field">
              <span id="historical-label">Historical Days</span>
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
              <small id="historical-help" class="dss-hint">
                Số ngày bán hàng được dùng làm dữ liệu lịch sử.
              </small>
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
              <span id="forecast-label">Forecast Period</span>
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
              <small id="forecast-help" class="dss-hint">
                Số ngày tương lai cần dự báo.
              </small>
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
              Tạo dự báo khác
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

      <section class="dss-card" aria-labelledby="demand-result-title">
        <h2 id="demand-result-title" class="dss-card__title">Kết quả dự báo</h2>

        <div v-if="!result" class="dss-empty" role="status">
          <div class="dss-empty__art" aria-hidden="true">◇</div>
          <h2>Chưa có kết quả</h2>
          <p>Chọn sản phẩm, cấu hình Historical Days / Forecast Period rồi bấm “Tạo dự báo”.</p>
        </div>

        <template v-else>
          <div class="dss-result-grid">
            <div>
              <p class="dss-meta"><span>Tên sản phẩm</span>{{ displayProductName }}</p>
              <p class="dss-meta">
                <span>Số ngày lịch sử</span>{{ formatViNumber(result.historicalDays) }}
              </p>
              <p class="dss-meta">
                <span>Thời gian dự báo</span>{{ formatViNumber(result.forecastPeriod) }} ngày
              </p>
              <p class="dss-meta">
                <span>Nhu cầu TB / ngày</span>{{ formatViNumber(result.averageDailyDemand) }}
              </p>
              <p class="dss-meta">
                <span>Thời gian tạo</span>{{ formatViDateTime(result.generatedAt) }}
              </p>
            </div>
            <div class="dss-highlight" aria-label="Tổng nhu cầu dự báo">
              <span>Tổng nhu cầu dự báo</span>
              <strong>{{ formatViNumber(result.predictedDemand) }}</strong>
              <em>đơn vị</em>
            </div>
          </div>

          <section class="dss-kpi-grid" style="margin-top: 1rem" aria-label="Tóm tắt chỉ số">
            <article class="dss-kpi">
              <span class="dss-kpi__label">Sản phẩm</span>
              <strong>{{ displayProductName }}</strong>
            </article>
            <article class="dss-kpi">
              <span class="dss-kpi__label">Lịch sử</span>
              <strong>{{ formatViNumber(result.historicalDays) }} ngày</strong>
            </article>
            <article class="dss-kpi">
              <span class="dss-kpi__label">Kỳ dự báo</span>
              <strong>{{ formatViNumber(result.forecastPeriod) }} ngày</strong>
            </article>
            <article class="dss-kpi">
              <span class="dss-kpi__label">TB / ngày</span>
              <strong>{{ formatViNumber(result.averageDailyDemand) }}</strong>
            </article>
            <article class="dss-kpi dss-kpi--accent">
              <span class="dss-kpi__label">Nhu cầu dự báo</span>
              <strong>{{ formatViNumber(result.predictedDemand) }}</strong>
            </article>
            <article class="dss-kpi">
              <span class="dss-kpi__label">Thời điểm tạo</span>
              <strong>{{ formatViDateTime(result.generatedAt) }}</strong>
            </article>
          </section>
        </template>
      </section>
    </div>
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
.dss-btn:focus-visible {
  outline: 2px solid #1976d2;
  outline-offset: 2px;
}
</style>
