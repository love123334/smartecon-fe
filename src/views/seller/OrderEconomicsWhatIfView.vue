<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
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
      <div class="economics-header__row">
        <div>
          <span class="economics-eyebrow">Công cụ tính hiệu quả đơn hàng</span>
          <h1>What-if Hiệu suất</h1>
          <p class="dss-page__sub">
            Mô phỏng một đơn hàng có thực sự tạo ra lợi nhuận sau toàn bộ biến phí.
          </p>
        </div>
        <span class="economics-live"><i></i> Giá bán và giá vốn từ hệ thống</span>
      </div>
    </header>

    <section class="dss-card economics-input" aria-labelledby="economics-input-title">
      <div class="economics-section-head">
        <div>
          <span class="economics-step">01 · Giả định kịch bản</span>
          <h2 id="economics-input-title" class="dss-card__title">Chi phí trên mỗi đơn hàng</h2>
        </div>
        <button type="button" class="dss-btn dss-btn--outline" @click="restoreDefaults">
          Khôi phục mặc định
        </button>
      </div>

      <div v-if="loadError" class="dss-alert dss-alert--warn" role="alert">{{ loadError }}</div>

      <div class="economics-product-grid">
        <label class="dss-field economics-product-field">
          <span>Sản phẩm của người bán</span>
          <select
            v-model.number="productId"
            class="dss-input"
            :disabled="productsLoading || !products.length"
          >
            <option disabled value="">— Chọn sản phẩm từ hệ thống —</option>
            <option v-for="item in products" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
          <small class="dss-hint">
            {{ productsLoading ? 'Đang tải danh sách sản phẩm…' : 'Danh sách được lọc theo người bán đang đăng nhập.' }}
          </small>
        </label>

        <label class="dss-field economics-readonly">
          <span>Giá bán</span>
          <div class="economics-readonly__value">
            {{ detailLoading ? 'Đang tải…' : product ? formatOrderEconomicsVnd(product.price) : '—' }}
          </div>
          <small v-if="errors.price" class="economics-error">{{ errors.price }}</small>
          <small v-else class="dss-hint">Đọc trực tiếp từ cơ sở dữ liệu.</small>
        </label>

        <label class="dss-field economics-readonly">
          <span>Giá vốn</span>
          <div class="economics-readonly__value">
            {{ detailLoading ? 'Đang tải…' : product ? formatOrderEconomicsVnd(product.costPrice) : '—' }}
          </div>
          <small v-if="errors.costPrice" class="economics-error">{{ errors.costPrice }}</small>
          <small v-else class="dss-hint">Không thể chỉnh sửa tại công cụ này.</small>
        </label>
      </div>

      <div class="economics-cost-grid">
        <label class="dss-field">
          <span>Chi phí đóng gói</span>
          <div class="economics-number-input">
            <input v-model.number="packagingCost" class="dss-input" type="number" min="0" step="1000" />
            <em>₫</em>
          </div>
          <small v-if="errors.packagingCost" class="economics-error">{{ errors.packagingCost }}</small>
        </label>

        <label class="dss-field">
          <span>Phí nền tảng</span>
          <div class="economics-number-input">
            <input v-model.number="platformFeePercent" class="dss-input" type="number" min="0" max="100" step="0.1" />
            <em>%</em>
          </div>
          <small v-if="errors.platformFeePercent" class="economics-error">{{ errors.platformFeePercent }}</small>
        </label>

        <label class="dss-field">
          <span>Phí tiếp thị liên kết</span>
          <div class="economics-number-input">
            <input v-model.number="affiliatePercent" class="dss-input" type="number" min="0" max="100" step="0.1" />
            <em>%</em>
          </div>
          <small v-if="errors.affiliatePercent" class="economics-error">{{ errors.affiliatePercent }}</small>
        </label>

        <label class="dss-field">
          <span>Quảng cáo / đơn hàng</span>
          <div class="economics-number-input">
            <input v-model.number="adsPerOrder" class="dss-input" type="number" min="0" step="1000" />
            <em>₫</em>
          </div>
          <small v-if="errors.adsPerOrder" class="economics-error">{{ errors.adsPerOrder }}</small>
        </label>

        <label class="dss-field">
          <span>Dự phòng hoàn trả</span>
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
          <span>Lợi nhuận đóng góp / đơn</span>
          <strong>{{ formatOrderEconomicsVnd(result.contributionPerOrder) }}</strong>
          <small>Lợi nhuận đóng góp sau quảng cáo</small>
        </article>
        <article class="economics-kpi" :class="`economics-kpi--${decisionContent.tone}`">
          <span>Biên lợi nhuận đóng góp</span>
          <strong>{{ formatOrderEconomicsPercent(result.contributionMarginPercent) }}</strong>
          <small>Ngưỡng mở rộng tham chiếu: 15%</small>
        </article>
        <article class="economics-kpi">
          <span>Quảng cáo hòa vốn / đơn</span>
          <strong>{{ formatOrderEconomicsVnd(result.breakEvenAdsPerOrder) }}</strong>
          <small>Mức quảng cáo tối đa trước khi hòa vốn</small>
        </article>
        <article class="economics-kpi economics-kpi--decision" :class="`economics-kpi--${decisionContent.tone}`">
          <span>Quyết định</span>
          <strong>{{ decisionContent.label }}</strong>
          <small>{{ decisionContent.title }}</small>
        </article>
      </section>

      <div class="economics-analysis-grid">
        <section class="dss-card" aria-labelledby="economics-breakdown-title">
          <div class="economics-section-head">
            <div>
              <span class="economics-step">02 · Phân rã</span>
              <h2 id="economics-breakdown-title" class="dss-card__title">Cấu trúc doanh thu và chi phí</h2>
            </div>
          </div>
          <div class="economics-breakdown">
            <div><span>Giá bán</span><strong>{{ formatOrderEconomicsVnd(product.price) }}</strong></div>
            <div><span>Giá vốn</span><strong>− {{ formatOrderEconomicsVnd(product.costPrice) }}</strong></div>
            <div><span>Chi phí đóng gói</span><strong>− {{ formatOrderEconomicsVnd(packagingCost) }}</strong></div>
            <div><span>Phí nền tảng ({{ formatOrderEconomicsPercent(platformFeePercent) }})</span><strong>− {{ formatOrderEconomicsVnd(result.platformFeeAmount) }}</strong></div>
            <div><span>Phí tiếp thị liên kết ({{ formatOrderEconomicsPercent(affiliatePercent) }})</span><strong>− {{ formatOrderEconomicsVnd(result.affiliateFeeAmount) }}</strong></div>
            <div><span>Dự phòng hoàn trả ({{ formatOrderEconomicsPercent(refundReservePercent) }})</span><strong>− {{ formatOrderEconomicsVnd(result.refundReserveAmount) }}</strong></div>
            <div class="economics-breakdown__subtotal"><span>Lợi nhuận trước quảng cáo</span><strong>{{ formatOrderEconomicsVnd(result.preAdsContribution) }}</strong></div>
            <div><span>Quảng cáo / đơn hàng</span><strong>− {{ formatOrderEconomicsVnd(adsPerOrder) }}</strong></div>
            <div class="economics-breakdown__total"><span>Lợi nhuận đóng góp / đơn</span><strong>{{ formatOrderEconomicsVnd(result.contributionPerOrder) }}</strong></div>
          </div>
        </section>

        <section class="dss-card economics-decision" :class="`economics-decision--${decisionContent.tone}`" aria-labelledby="economics-decision-title">
          <span class="economics-step">03 · Khuyến nghị</span>
          <span class="economics-decision__badge">{{ decisionContent.label }}</span>
          <h2 id="economics-decision-title">{{ decisionContent.title }}</h2>
          <p>{{ decisionContent.detail }}</p>
          <dl>
            <div><dt>Tổng biến phí</dt><dd>{{ formatOrderEconomicsVnd(variableCostTotal) }}</dd></div>
            <div><dt>Tỷ trọng biến phí</dt><dd>{{ formatOrderEconomicsPercent((variableCostTotal / product.price) * 100) }}</dd></div>
            <div><dt>Ngân sách quảng cáo còn lại</dt><dd>{{ formatOrderEconomicsVnd(result.breakEvenAdsPerOrder - adsPerOrder) }}</dd></div>
          </dl>
          <small>Kết quả thay đổi tức thời theo giả định và không ghi dữ liệu mô phỏng vào cơ sở dữ liệu.</small>
        </section>
      </div>
    </template>

    <section v-else class="dss-card economics-empty">
      <span aria-hidden="true">∑</span>
      <div>
        <h2>Chọn sản phẩm có giá bán và giá vốn hợp lệ</h2>
        <p>Công cụ chỉ hiển thị kết quả khi hệ thống trả đủ dữ liệu sản phẩm.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.economics-page { max-width: 1360px; }
.economics-header { padding-top: .35rem; }
.economics-header__row, .economics-section-head { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
.economics-eyebrow, .economics-step { color:var(--dss-blue); font-size:.72rem; font-weight:800; letter-spacing:.11em; text-transform:uppercase; }
.economics-live { display:inline-flex; align-items:center; gap:.55rem; border:1px solid #a7d7b0; border-radius:999px; background:#effaf1; color:#256b32; padding:.55rem .8rem; font-size:.78rem; font-weight:700; }
.economics-live i { width:.5rem; height:.5rem; border-radius:50%; background:#2e7d32; box-shadow:0 0 0 4px rgba(46,125,50,.12); }
.economics-input { border-top:2px solid #90caf9; }
.economics-product-grid { display:grid; grid-template-columns:2fr 1fr 1fr; gap:1rem; margin-top:1.2rem; }
.economics-cost-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:1rem; margin-top:1.35rem; }
.economics-readonly__value { min-height:44px; box-sizing:border-box; display:flex; align-items:center; border:1px solid #cfd8dc; border-radius:8px; background:#f3f6fa; color:#263238; padding:.65rem .8rem; font-weight:800; }
.economics-number-input { position:relative; width:100%; }
.economics-number-input .dss-input { width:100%; box-sizing:border-box; padding-right:2.35rem; }
.economics-number-input em { position:absolute; right:.8rem; top:50%; transform:translateY(-50%); color:#546e7a; font-size:.8rem; font-style:normal; font-weight:800; pointer-events:none; }
.economics-error { color:#c62828; }
.economics-kpis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:1rem; margin:1rem 0; }
.economics-kpi { min-height:148px; padding:1.15rem; border:1px solid #d8e3ef; border-radius:14px; background:#fff; box-shadow:var(--dss-shadow); }
.economics-kpi span, .economics-kpi small { display:block; color:#546e7a; }
.economics-kpi span { font-size:.74rem; font-weight:800; letter-spacing:.06em; text-transform:uppercase; }
.economics-kpi strong { display:block; margin:.65rem 0 .35rem; color:#17324d; font-size:clamp(1.2rem,2vw,1.65rem); }
.economics-kpi--scale { border-color:#a5d6a7; background:#f7fcf7; }
.economics-kpi--scale strong { color:#1b5e20; }
.economics-kpi--test { border-color:#ffe082; background:#fffdf5; }
.economics-kpi--test strong { color:#9a5b00; }
.economics-kpi--fix, .economics-kpi--negative { border-color:#ef9a9a; background:#fff8f8; }
.economics-kpi--fix strong, .economics-kpi--negative strong { color:#b71c1c; }
.economics-kpi--decision strong { font-size:1.1rem; letter-spacing:.03em; }
.economics-analysis-grid { display:grid; grid-template-columns:minmax(0,1.25fr) minmax(340px,.75fr); gap:1rem; }
.economics-analysis-grid > .dss-card { color:#263238; }
.economics-breakdown { margin-top:1rem; }
.economics-breakdown > div { display:flex; justify-content:space-between; gap:1rem; padding:.72rem 0; border-bottom:1px solid #e3e8ef; }
.economics-breakdown span { color:#455a64; }
.economics-breakdown strong { color:#263238; text-align:right; }
.economics-breakdown__subtotal { margin-top:.35rem; border-top:1px solid #90caf9; }
.economics-breakdown__subtotal strong { color:#1565c0; }
.economics-breakdown__total { font-size:1.04rem; border-bottom:0 !important; }
.economics-breakdown__total span, .economics-breakdown__total strong { color:#0d47a1; font-weight:800; }
.economics-decision { position:relative; overflow:hidden; }
.economics-decision::after { content:''; position:absolute; width:180px; height:180px; right:-70px; top:-70px; border-radius:50%; background:rgba(25,118,210,.045); pointer-events:none; }
.economics-decision > * { position:relative; z-index:1; }
.economics-decision__badge { display:inline-block; margin:1rem 0 .75rem; padding:.42rem .65rem; border-radius:8px; background:#e3f2fd; color:#0d47a1; font-size:.75rem; font-weight:900; }
.economics-decision h2 { color:#17324d; font-size:1.3rem; }
.economics-decision p { color:#455a64; line-height:1.65; }
.economics-decision dl { margin:1.2rem 0; }
.economics-decision dl div { display:flex; justify-content:space-between; gap:1rem; padding:.65rem 0; border-bottom:1px solid #e3e8ef; }
.economics-decision dt { color:#546e7a; }
.economics-decision dd { margin:0; color:#263238; font-weight:800; text-align:right; }
.economics-decision > small { display:block; color:#607d8b; line-height:1.5; }
.economics-decision--scale { border-color:#a5d6a7; }
.economics-decision--test { border-color:#ffe082; }
.economics-decision--fix { border-color:#ef9a9a; }
.economics-empty { display:flex; align-items:center; gap:1rem; color:#607d8b; }
.economics-empty > span { display:grid; place-items:center; width:48px; height:48px; flex:0 0 auto; border-radius:14px; background:#e3f2fd; color:#1565c0; font-size:1.4rem; }
.economics-empty h2 { margin:0 0 .3rem; color:#263238; font-size:1rem; }
.economics-empty p { margin:0; }
@media (max-width:1050px) { .economics-cost-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } .economics-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); } .economics-analysis-grid { grid-template-columns:1fr; } }
@media (max-width:760px) { .economics-product-grid,.economics-cost-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .economics-product-field { grid-column:1/-1; } }
@media (max-width:620px) { .economics-header__row,.economics-section-head { align-items:flex-start; flex-direction:column; } .economics-product-grid,.economics-cost-grid,.economics-kpis { grid-template-columns:1fr; } .economics-product-field { grid-column:auto; } .economics-live { align-self:flex-start; } }
</style>
