<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import { ApiError } from '@/api/http/client'
import {
  getProductUnitEconomicsById,
  listProducts,
  type ProductUnitEconomicsApi,
} from '@/api/real/products'
import { useAuthStore } from '@/stores/auth'
import {
  ORDER_ECONOMICS_DEFAULTS,
  calculateOrderEconomics,
  formatOrderEconomicsPercent,
  formatOrderEconomicsVnd,
  validateOrderEconomicsInput,
  type OrderEconomicsDecision,
  type OrderEconomicsErrors,
} from '@/utils/orderEconomics'

interface ProductOption {
  id: number
  name: string
}

const auth = useAuthStore()
const products = ref<ProductOption[]>([])
const productId = ref<number | ''>('')
const product = ref<ProductUnitEconomicsApi | null>(null)
const productsLoading = ref(false)
const detailLoading = ref(false)
const loadError = ref('')

const packagingCost = ref(ORDER_ECONOMICS_DEFAULTS.packagingCost)
const platformFeePercent = ref(ORDER_ECONOMICS_DEFAULTS.platformFeePercent)
const affiliatePercent = ref(ORDER_ECONOMICS_DEFAULTS.affiliatePercent)
const adsPerOrder = ref(ORDER_ECONOMICS_DEFAULTS.adsPerOrder)
const refundReservePercent = ref(ORDER_ECONOMICS_DEFAULTS.refundReservePercent)

const sellerId = computed(() => {
  const raw = auth.user?.backendId ?? auth.user?.id
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : null
})

const calculatorInput = computed(() => ({
  price: product.value?.price ?? Number.NaN,
  costPrice: product.value?.costPrice ?? Number.NaN,
  packagingCost: Number(packagingCost.value),
  platformFeePercent: Number(platformFeePercent.value),
  affiliatePercent: Number(affiliatePercent.value),
  adsPerOrder: Number(adsPerOrder.value),
  refundReservePercent: Number(refundReservePercent.value),
}))

const errors = computed<OrderEconomicsErrors>(() =>
  validateOrderEconomicsInput(calculatorInput.value),
)
const canCalculate = computed(
  () => Boolean(product.value) && Object.keys(errors.value).length === 0,
)
const result = computed(() =>
  canCalculate.value ? calculateOrderEconomics(calculatorInput.value) : null,
)
const variableCostTotal = computed(() => {
  if (!result.value || !product.value) return 0
  return (
    product.value.costPrice +
    packagingCost.value +
    result.value.totalRateCost +
    adsPerOrder.value
  )
})
const decisionContent = computed(() => decisionCopy(result.value?.decision))

const adsHeadroom = computed(() =>
  result.value ? result.value.breakEvenAdsPerOrder - adsPerOrder.value : 0,
)
const adsFillPercent = computed(() => {
  if (!result.value) return 0
  const cap = Math.max(result.value.breakEvenAdsPerOrder, adsPerOrder.value, 1)
  return Math.min(100, (adsPerOrder.value / cap) * 100)
})

const composition = computed(() => {
  if (!result.value || !product.value) return []
  const price = product.value.price
  const profit = result.value.contributionPerOrder
  const rows = [
    { key: 'cogs', label: 'Giá vốn', value: product.value.costPrice, color: '#1e88e5' },
    { key: 'pack', label: 'Đóng gói', value: packagingCost.value, color: '#26c6da' },
    { key: 'plat', label: 'Phí sàn', value: result.value.platformFeeAmount, color: '#fb8c00' },
    { key: 'aff', label: 'Affiliate', value: result.value.affiliateFeeAmount, color: '#8e24aa' },
    { key: 'refund', label: 'Dự phòng HT', value: result.value.refundReserveAmount, color: '#f9a825' },
    { key: 'ads', label: 'Quảng cáo', value: adsPerOrder.value, color: '#e53935' },
    profit >= 0
      ? { key: 'profit', label: 'Lãi', value: profit, color: '#43a047' }
      : { key: 'loss', label: 'Lỗ', value: Math.abs(profit), color: '#c62828' },
  ]
  const basis = Math.max(price, rows.reduce((sum, row) => sum + Math.max(0, row.value), 0), 1)
  return rows
    .filter((row) => row.value > 0)
    .map((row) => ({
      ...row,
      pct: (row.value / basis) * 100,
    }))
})

onMounted(loadProducts)

watch(productId, async (id) => {
  product.value = null
  loadError.value = ''
  if (!id) return
  detailLoading.value = true
  try {
    const detail = await getProductUnitEconomicsById(id)
    if (!sellerId.value || detail.sellerId !== sellerId.value) {
      throw new Error('Sản phẩm không thuộc người bán hiện tại.')
    }
    product.value = detail
  } catch (error) {
    loadError.value = mapLoadError(error)
  } finally {
    detailLoading.value = false
  }
})

async function loadProducts() {
  productsLoading.value = true
  loadError.value = ''
  try {
    if (!sellerId.value) throw new Error('Không xác định được người bán từ phiên đăng nhập.')
    const rows = await listProducts({ sellerId: sellerId.value, size: 100 })
    products.value = rows
      .map((item) => ({ id: Number(item.id), name: item.name }))
      .filter((item) => Number.isInteger(item.id) && item.id > 0)
    if (!products.value.length) {
      loadError.value = 'Người bán hiện tại chưa có sản phẩm trong cơ sở dữ liệu.'
      return
    }
    productId.value = products.value[0]?.id ?? ''
  } catch (error) {
    products.value = []
    loadError.value = mapLoadError(error)
  } finally {
    productsLoading.value = false
  }
}

function restoreDefaults() {
  packagingCost.value = ORDER_ECONOMICS_DEFAULTS.packagingCost
  platformFeePercent.value = ORDER_ECONOMICS_DEFAULTS.platformFeePercent
  affiliatePercent.value = ORDER_ECONOMICS_DEFAULTS.affiliatePercent
  adsPerOrder.value = ORDER_ECONOMICS_DEFAULTS.adsPerOrder
  refundReservePercent.value = ORDER_ECONOMICS_DEFAULTS.refundReservePercent
}

function mapLoadError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    if (error.status === 403) return 'Bạn không có quyền xem dữ liệu giá vốn của sản phẩm.'
    if (error.status === 404) return 'Không tìm thấy sản phẩm trong hệ thống.'
    return error.message
  }
  return error instanceof Error ? error.message : 'Không thể tải dữ liệu sản phẩm từ hệ thống.'
}

function decisionCopy(decision?: OrderEconomicsDecision) {
  if (decision === 'SCALE') {
    return {
      label: 'CÓ THỂ MỞ RỘNG',
      title: 'Có khoảng lợi nhuận để mở rộng',
      detail: 'Biên lợi nhuận đóng góp đạt từ 15%. Có thể tăng quy mô có kiểm soát và tiếp tục theo dõi chi phí thực tế.',
      tone: 'scale',
    }
  }
  if (decision === 'TEST') {
    return {
      label: 'THỬ NGHIỆM / TỐI ƯU',
      title: 'Đơn hàng có lời nhưng biên còn mỏng',
      detail: 'Biên lợi nhuận đóng góp dương nhưng dưới 15%. Nên tối ưu các khoản phí, quảng cáo hoặc giá vốn trước khi mở rộng.',
      tone: 'test',
    }
  }
  return {
    label: 'CẦN SỬA / DỪNG',
    title: 'Cấu trúc chi phí chưa đạt điểm hòa vốn',
    detail: 'Biên lợi nhuận đóng góp không dương. Cần giảm biến phí, giá vốn hoặc điều chỉnh giá trước khi tiếp tục.',
    tone: 'fix',
  }
}
</script>

<template>
  <div class="dss-page economics-page">
    <header class="dss-page__header economics-header">
      <nav class="dss-crumb" aria-label="Breadcrumb">
        <RouterLink to="/seller/products">Bảng điều khiển người bán</RouterLink>
        <span>/</span>
        <RouterLink to="/seller/dss">DSS</RouterLink>
        <span>/</span>
        <span>What-if Hiệu suất</span>
      </nav>
      <div class="economics-title-row">
        <div>
          <h1>What-if Hiệu suất</h1>
          <p class="dss-page__sub">
            Xem một đơn còn lời sau giá vốn, phí sàn, affiliate, quảng cáo và hoàn trả.
          </p>
        </div>
        <button type="button" class="dss-btn dss-btn--outline" @click="restoreDefaults">
          Khôi phục mặc định
        </button>
      </div>
    </header>

    <LoadingSpinner
      v-if="productsLoading"
      page
      label="Đang tải dữ liệu sản phẩm & chi phí..."
      sublabel="Đang tính toán các chỉ số kinh tế đơn hàng (Order Economics)."
    />

    <section v-else class="dss-card economics-input" aria-labelledby="economics-input-title">
      <h2 id="economics-input-title" class="economics-inline-title">Giả định chi phí / đơn</h2>
      <div v-if="loadError" class="dss-alert dss-alert--warn" role="alert">{{ loadError }}</div>

      <div class="economics-product-grid">
        <label class="dss-field economics-product-field">
          <span>Sản phẩm</span>
          <select
            v-model.number="productId"
            class="dss-input"
            :disabled="productsLoading || !products.length"
          >
            <option disabled value="">— Chọn sản phẩm —</option>
            <option v-for="item in products" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
          <small v-if="productsLoading" class="dss-hint">Đang tải sản phẩm…</small>
        </label>

        <label class="dss-field economics-readonly">
          <span>Giá bán</span>
          <div class="economics-readonly__value">
            {{ detailLoading ? '…' : product ? formatOrderEconomicsVnd(product.price) : '—' }}
          </div>
          <small v-if="errors.price" class="economics-error">{{ errors.price }}</small>
        </label>

        <label class="dss-field economics-readonly">
          <span>Giá vốn</span>
          <div class="economics-readonly__value">
            {{ detailLoading ? '…' : product ? formatOrderEconomicsVnd(product.costPrice) : '—' }}
          </div>
          <small v-if="errors.costPrice" class="economics-error">{{ errors.costPrice }}</small>
        </label>
      </div>

      <div class="economics-cost-grid">
        <label class="dss-field">
          <span>Đóng gói</span>
          <div class="economics-number-input">
            <input v-model.number="packagingCost" class="dss-input" type="number" min="0" step="1000" />
            <em>₫</em>
          </div>
          <small v-if="errors.packagingCost" class="economics-error">{{ errors.packagingCost }}</small>
        </label>
        <label class="dss-field">
          <span>Phí sàn</span>
          <div class="economics-number-input">
            <input v-model.number="platformFeePercent" class="dss-input" type="number" min="0" max="100" step="0.1" />
            <em>%</em>
          </div>
          <small v-if="errors.platformFeePercent" class="economics-error">{{ errors.platformFeePercent }}</small>
        </label>
        <label class="dss-field">
          <span>Affiliate</span>
          <div class="economics-number-input">
            <input v-model.number="affiliatePercent" class="dss-input" type="number" min="0" max="100" step="0.1" />
            <em>%</em>
          </div>
          <small v-if="errors.affiliatePercent" class="economics-error">{{ errors.affiliatePercent }}</small>
        </label>
        <label class="dss-field">
          <span>QC / đơn</span>
          <div class="economics-number-input">
            <input v-model.number="adsPerOrder" class="dss-input" type="number" min="0" step="1000" />
            <em>₫</em>
          </div>
          <small v-if="errors.adsPerOrder" class="economics-error">{{ errors.adsPerOrder }}</small>
        </label>
        <label class="dss-field">
          <span>Dự phòng HT</span>
          <div class="economics-number-input">
            <input v-model.number="refundReservePercent" class="dss-input" type="number" min="0" max="100" step="0.1" />
            <em>%</em>
          </div>
          <small v-if="errors.refundReservePercent" class="economics-error">{{ errors.refundReservePercent }}</small>
        </label>
      </div>
    </section>

    <template v-if="result && product">
      <section class="economics-kpis" aria-label="Chỉ số ra quyết định">
        <article class="economics-kpi" :class="{ 'economics-kpi--negative': result.contributionPerOrder <= 0 }">
          <span>Lãi / đơn</span>
          <strong>{{ formatOrderEconomicsVnd(result.contributionPerOrder) }}</strong>
        </article>
        <article class="economics-kpi" :class="`economics-kpi--${decisionContent.tone}`">
          <span>Biên lãi</span>
          <strong>{{ formatOrderEconomicsPercent(result.contributionMarginPercent) }}</strong>
          <small>Ngưỡng mở rộng 15%</small>
        </article>
        <article class="economics-kpi">
          <span>QC hòa vốn</span>
          <strong>{{ formatOrderEconomicsVnd(result.breakEvenAdsPerOrder) }}</strong>
          <div class="economics-meter" :class="{ 'economics-meter--over': adsHeadroom < 0 }">
            <i :style="{ width: `${adsFillPercent}%` }" />
          </div>
          <small>
            {{ adsHeadroom >= 0 ? `Còn ${formatOrderEconomicsVnd(adsHeadroom)}` : `Vượt ${formatOrderEconomicsVnd(Math.abs(adsHeadroom))}` }}
          </small>
        </article>
        <article class="economics-kpi economics-kpi--decision" :class="`economics-kpi--${decisionContent.tone}`">
          <span>Kết luận</span>
          <strong>{{ decisionContent.label }}</strong>
        </article>
      </section>

      <div class="economics-analysis-grid">
        <section class="dss-card economics-breakdown-card" aria-labelledby="economics-breakdown-title">
          <div class="economics-section-head">
            <h2 id="economics-breakdown-title" class="dss-card__title">Cấu trúc 1 đơn</h2>
            <strong class="economics-price-chip">Giá {{ formatOrderEconomicsVnd(product.price) }}</strong>
          </div>

          <div class="economics-stack" aria-hidden="true">
            <span
              v-for="row in composition"
              :key="row.key"
              :style="{ width: `${Math.max(row.pct, 1.2)}%`, background: row.color }"
              :title="`${row.label} ${formatOrderEconomicsPercent(row.pct)}`"
            />
          </div>

          <ul class="economics-legend">
            <li v-for="row in composition" :key="`lg-${row.key}`">
              <i :style="{ background: row.color }" />
              <span>{{ row.label }}</span>
              <em>{{ formatOrderEconomicsPercent(row.pct) }}</em>
              <strong>{{ formatOrderEconomicsVnd(row.value) }}</strong>
            </li>
          </ul>
        </section>

        <section class="dss-card economics-decision" :class="`economics-decision--${decisionContent.tone}`" aria-labelledby="economics-decision-title">
          <div class="economics-decision__head">
            <h2 id="economics-decision-title">{{ decisionContent.title }}</h2>
            <span class="economics-decision__badge" :class="`economics-decision__badge--${decisionContent.tone}`">
              {{ decisionContent.label }}
            </span>
          </div>
          <p>{{ decisionContent.detail }}</p>
          <dl>
            <div><dt>Biến phí</dt><dd>{{ formatOrderEconomicsVnd(variableCostTotal) }}</dd></div>
            <div><dt>Tỷ trọng</dt><dd>{{ formatOrderEconomicsPercent((variableCostTotal / product.price) * 100) }}</dd></div>
            <div>
              <dt>Dư QC</dt>
              <dd :class="{ 'economics-dd--warn': adsHeadroom < 0 }">
                {{ formatOrderEconomicsVnd(adsHeadroom) }}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </template>

    <section v-else class="dss-card economics-empty">
      <span aria-hidden="true">∑</span>
      <div>
        <h2>Chọn sản phẩm có giá bán và giá vốn hợp lệ</h2>
        <p>Kết quả hiện khi hệ thống trả đủ giá bán và giá vốn.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.economics-page { max-width: 1180px; }
.economics-header { margin-bottom: .85rem; padding-top: .15rem; }
.economics-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: .75rem 1rem;
  margin-top: .35rem;
}
.economics-title-row h1 { margin: 0 0 .2rem; }
.economics-title-row .dss-page__sub { max-width: 64ch; font-size: .9rem; }
.economics-title-row .dss-btn { flex: 0 0 auto; white-space: nowrap; }
.economics-inline-title {
  margin: 0 0 .75rem;
  color: #1565c0;
  font-size: .95rem;
  font-weight: 700;
}
.economics-input { padding: 1rem 1.1rem 1.05rem; border-top: 2px solid #90caf9; }
.economics-input :deep(.dss-input) { height: 40px; }
.economics-product-grid { display: grid; grid-template-columns: 1.6fr .7fr .7fr; gap: .7rem .85rem; }
.economics-cost-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: .7rem .85rem; margin-top: .85rem; }
.economics-product-grid .dss-field span,
.economics-cost-grid .dss-field span { font-size: .78rem; }
.economics-readonly__value {
  min-height: 40px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  border: 1px solid #cfd8dc;
  border-radius: 8px;
  background: #f3f6fa;
  color: #263238;
  padding: .45rem .7rem;
  font-weight: 800;
}
.economics-number-input { position: relative; width: 100%; }
.economics-number-input .dss-input { width: 100%; box-sizing: border-box; min-height: 40px; padding-right: 2.1rem; }
.economics-number-input em {
  position: absolute;
  right: .7rem;
  top: 50%;
  transform: translateY(-50%);
  color: #546e7a;
  font-size: .78rem;
  font-style: normal;
  font-weight: 800;
  pointer-events: none;
}
.economics-error { color: #c62828; }
.economics-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; margin: 0 0 .85rem; }
.economics-kpi {
  padding: .8rem .9rem .75rem;
  border: 1px solid #d8e3ef;
  border-radius: 12px;
  background: #fff;
  box-shadow: var(--dss-shadow);
}
.economics-kpi span, .economics-kpi small { display: block; color: #546e7a; }
.economics-kpi span { font-size: .7rem; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
.economics-kpi strong { display: block; margin: .35rem 0 .15rem; color: #17324d; font-size: clamp(1.05rem, 1.8vw, 1.35rem); line-height: 1.2; }
.economics-kpi small { font-size: .72rem; }
.economics-kpi--scale { border-color: #a5d6a7; background: #f7fcf7; }
.economics-kpi--scale strong { color: #1b5e20; }
.economics-kpi--test { border-color: #ffe082; background: #fffdf5; }
.economics-kpi--test strong { color: #9a5b00; }
.economics-kpi--fix, .economics-kpi--negative { border-color: #ef9a9a; background: #fff8f8; }
.economics-kpi--fix strong, .economics-kpi--negative strong { color: #b71c1c; }
.economics-kpi--decision strong { font-size: .92rem; letter-spacing: .02em; }
.economics-meter {
  height: 6px;
  margin: .45rem 0 .3rem;
  overflow: hidden;
  border-radius: 99px;
  background: #eceff1;
}
.economics-meter i { display: block; height: 100%; background: #43a047; }
.economics-meter--over i { background: #e53935; }
.economics-analysis-grid { display: grid; grid-template-columns: minmax(320px, 1.2fr) minmax(280px, .8fr); gap: .85rem; align-items: stretch; }
.economics-analysis-grid > .dss-card { min-width: 0; padding: 1rem 1.1rem; color: #263238; }
.economics-section-head { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
.economics-section-head .dss-card__title { margin: 0; }
.economics-price-chip {
  flex: 0 0 auto;
  padding: .22rem .55rem;
  border-radius: 999px;
  background: #e3f2fd;
  color: #0d47a1;
  font-size: .78rem;
  white-space: nowrap;
}
.economics-stack {
  display: flex;
  height: 16px;
  margin: .75rem 0 .7rem;
  overflow: hidden;
  border-radius: 999px;
  background: #eceff1;
}
.economics-stack span { display: block; height: 100%; }
.economics-legend {
  display: flex;
  flex-direction: column;
  gap: .1rem;
  list-style: none;
  margin: 0;
  padding: 0;
}
.economics-legend li {
  display: flex;
  align-items: center;
  gap: .55rem;
  min-width: 0;
  padding: .38rem 0;
  border-bottom: 1px solid #eef2f6;
  font-size: .84rem;
}
.economics-legend i { width: 8px; height: 8px; flex: 0 0 auto; border-radius: 99px; }
.economics-legend span { flex: 1 1 auto; min-width: 0; color: #546e7a; }
.economics-legend em,
.economics-legend strong {
  flex: 0 0 auto;
  white-space: nowrap;
}
.economics-legend em { color: #90a4ae; font-style: normal; font-size: .72rem; font-weight: 700; }
.economics-legend strong { color: #263238; }
.economics-decision { display: flex; flex-direction: column; }
.economics-decision__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: .5rem .75rem;
  margin-bottom: .45rem;
}
.economics-decision__badge {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  padding: .28rem .55rem;
  border-radius: 999px;
  background: #e3f2fd;
  color: #0d47a1;
  font-size: .68rem;
  font-weight: 800;
  letter-spacing: .02em;
  white-space: nowrap;
}
.economics-decision__badge--test { background: #fff8e1; color: #e65100; }
.economics-decision__badge--fix { background: #ffebee; color: #b71c1c; }
.economics-decision__badge--scale { background: #e8f5e9; color: #1b5e20; }
.economics-decision h2 { margin: 0; color: #17324d; font-size: 1.02rem; line-height: 1.35; }
.economics-decision p { margin: .35rem 0 0; color: #455a64; font-size: .88rem; line-height: 1.5; }
.economics-decision dl { margin: .7rem 0 0; }
.economics-decision dl div { display: flex; justify-content: space-between; align-items: baseline; gap: .75rem; padding: .42rem 0; border-bottom: 1px solid #e3e8ef; font-size: .86rem; }
.economics-decision dt { min-width: 0; color: #546e7a; }
.economics-decision dd { margin: 0; color: #263238; font-weight: 800; text-align: right; white-space: nowrap; }
.economics-dd--warn { color: #c62828; }
.economics-decision--scale { border-color: #a5d6a7; }
.economics-decision--test { border-color: #ffe082; }
.economics-decision--fix { border-color: #ef9a9a; }
.economics-empty { display: flex; align-items: center; gap: .85rem; color: #607d8b; padding: .9rem 1.1rem; }
.economics-empty > span { display: grid; place-items: center; width: 40px; height: 40px; flex: 0 0 auto; border-radius: 12px; background: #e3f2fd; color: #1565c0; font-size: 1.2rem; }
.economics-empty h2 { margin: 0 0 .2rem; color: #263238; font-size: .95rem; }
.economics-empty p { margin: 0; }
@media (max-width: 1050px) {
  .economics-analysis-grid { grid-template-columns: 1fr; }
  .economics-cost-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .economics-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 760px) {
  .economics-product-grid, .economics-cost-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .economics-product-field { grid-column: 1 / -1; }
}
@media (max-width: 620px) {
  .economics-title-row, .economics-section-head, .economics-decision__head { flex-direction: column; align-items: flex-start; }
  .economics-product-grid, .economics-cost-grid, .economics-kpis { grid-template-columns: 1fr; }
  .economics-product-field { grid-column: auto; }
  .economics-decision__badge { white-space: normal; }
}
</style>
