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

const composition = computed(() => {
  if (!result.value || !product.value) return []
  const price = product.value.price
  const rows = [
    { key: 'cogs', label: 'Giá vốn', value: product.value.costPrice, color: '#64b5f6' },
    { key: 'pack', label: 'Đóng gói', value: packagingCost.value, color: '#4fc3f7' },
    { key: 'plat', label: 'Phí sàn', value: result.value.platformFeeAmount, color: '#29b6f6' },
    { key: 'aff', label: 'Affiliate', value: result.value.affiliateFeeAmount, color: '#0288d1' },
    { key: 'refund', label: 'Dự phòng HT', value: result.value.refundReserveAmount, color: '#0277bd' },
    { key: 'ads', label: 'Quảng cáo', value: adsPerOrder.value, color: '#ef9a9a' },
    {
      key: 'profit',
      label: 'Lợi nhuận',
      value: Math.max(0, result.value.contributionPerOrder),
      color: '#66bb6a',
    },
  ]
  return rows
    .filter((row) => row.value > 0)
    .map((row) => ({
      ...row,
      pct: price > 0 ? Math.min(100, (row.value / price) * 100) : 0,
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

      <div class="economics-hero">
        <aside class="economics-shot" aria-hidden="true">
          <div class="economics-shot__chrome">
            <i></i><i></i><i></i>
            <span>What-if · hiệu suất đơn</span>
          </div>
          <div class="economics-shot__body">
            <div class="economics-shot__kpis">
              <div>
                <em>LN / đơn</em>
                <b>{{ result ? formatOrderEconomicsVnd(result.contributionPerOrder) : '—' }}</b>
              </div>
              <div>
                <em>Biên LN</em>
                <b>{{ result ? formatOrderEconomicsPercent(result.contributionMarginPercent) : '—' }}</b>
              </div>
            </div>
            <div class="economics-shot__bar">
              <span
                v-for="row in composition"
                :key="row.key"
                :style="{ width: `${row.pct}%`, background: row.color }"
              />
              <span v-if="!composition.length" class="economics-shot__bar-empty" />
            </div>
            <div class="economics-shot__legend">
              <span>Giá vốn</span>
              <span>Phí</span>
              <span>QC</span>
              <span>LN</span>
            </div>
          </div>
        </aside>
        <div class="economics-hero__copy">
          <span class="economics-eyebrow">Công cụ tính hiệu quả đơn hàng</span>
          <h1>What-if Hiệu suất</h1>
          <p class="dss-page__sub">
            Xem một đơn còn lời sau giá vốn, phí sàn, affiliate, quảng cáo và dự phòng hoàn trả.
          </p>
        </div>
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
        <section class="dss-card economics-breakdown-card" aria-labelledby="economics-breakdown-title">
          <div class="economics-section-head">
            <div>
              <span class="economics-step">02 · Phân rã</span>
              <h2 id="economics-breakdown-title" class="dss-card__title">Cấu trúc một đơn hàng</h2>
            </div>
            <strong class="economics-price-chip">{{ formatOrderEconomicsVnd(product.price) }}</strong>
          </div>

          <div class="economics-stack" aria-hidden="true">
            <span
              v-for="row in composition"
              :key="row.key"
              :style="{ width: `${Math.max(row.pct, 1.5)}%`, background: row.color }"
              :title="`${row.label} ${formatOrderEconomicsVnd(row.value)}`"
            />
          </div>

          <ul class="economics-legend">
            <li v-for="row in composition" :key="`lg-${row.key}`">
              <i :style="{ background: row.color }" />
              <span>{{ row.label }}</span>
              <strong>{{ formatOrderEconomicsVnd(row.value) }}</strong>
            </li>
            <li class="economics-legend__total">
              <span>Lợi nhuận đóng góp / đơn</span>
              <strong>{{ formatOrderEconomicsVnd(result.contributionPerOrder) }}</strong>
            </li>
          </ul>
        </section>

        <section class="dss-card economics-decision" :class="`economics-decision--${decisionContent.tone}`" aria-labelledby="economics-decision-title">
          <div class="economics-decision__head">
            <span class="economics-step">03 · Khuyến nghị</span>
            <span class="economics-decision__badge" :class="`economics-decision__badge--${decisionContent.tone}`">
              {{ decisionContent.label }}
            </span>
          </div>
          <h2 id="economics-decision-title">{{ decisionContent.title }}</h2>
          <p>{{ decisionContent.detail }}</p>
          <dl>
            <div><dt>Tổng biến phí</dt><dd>{{ formatOrderEconomicsVnd(variableCostTotal) }}</dd></div>
            <div><dt>Tỷ trọng biến phí</dt><dd>{{ formatOrderEconomicsPercent((variableCostTotal / product.price) * 100) }}</dd></div>
            <div><dt>Ngân sách quảng cáo còn lại</dt><dd>{{ formatOrderEconomicsVnd(result.breakEvenAdsPerOrder - adsPerOrder) }}</dd></div>
          </dl>
          <small>Kết quả đổi ngay theo giả định — không ghi vào cơ sở dữ liệu.</small>
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
.economics-hero {
  display: grid;
  grid-template-columns: minmax(280px, 0.95fr) minmax(0, 1.2fr);
  gap: 1.25rem;
  align-items: center;
}
.economics-hero__copy h1 { margin: .25rem 0 .4rem; }
.economics-shot {
  border: 1px solid #d7e3f4;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(180deg, #eef5ff 0%, #fff 55%);
  box-shadow: 0 10px 28px rgba(13, 71, 161, .08);
}
.economics-shot__chrome {
  display: flex;
  align-items: center;
  gap: .4rem;
  padding: .55rem .8rem;
  background: #e8eef8;
  color: #607d8b;
  font-size: .72rem;
  font-weight: 700;
  letter-spacing: .02em;
}
.economics-shot__chrome i {
  width: .52rem;
  height: .52rem;
  border-radius: 50%;
  background: #cfd8dc;
}
.economics-shot__chrome i:nth-child(1) { background: #ef9a9a; }
.economics-shot__chrome i:nth-child(2) { background: #ffe082; }
.economics-shot__chrome i:nth-child(3) { background: #a5d6a7; }
.economics-shot__chrome span { margin-left: .35rem; }
.economics-shot__body { padding: .9rem 1rem 1rem; }
.economics-shot__kpis {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .6rem;
  margin-bottom: .75rem;
}
.economics-shot__kpis div {
  padding: .65rem .7rem;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #e3e8ef;
}
.economics-shot__kpis em {
  display: block;
  font-style: normal;
  color: #78909c;
  font-size: .68rem;
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
}
.economics-shot__kpis b {
  display: block;
  margin-top: .2rem;
  color: #0d47a1;
  font-size: .98rem;
}
.economics-shot__bar, .economics-stack {
  display: flex;
  height: 14px;
  overflow: hidden;
  border-radius: 999px;
  background: #eceff1;
}
.economics-shot__bar span, .economics-stack span { display: block; height: 100%; }
.economics-shot__bar-empty { flex: 1; background: #d7e3f4; }
.economics-shot__legend {
  display: flex;
  justify-content: space-between;
  margin-top: .45rem;
  color: #78909c;
  font-size: .68rem;
  font-weight: 700;
}
.economics-section-head { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }
.economics-eyebrow, .economics-step {
  display: block;
  color: var(--dss-blue);
  font-size: .72rem;
  font-weight: 800;
  letter-spacing: .11em;
  text-transform: uppercase;
}
.economics-input { border-top: 2px solid #90caf9; }
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
.economics-kpi--decision strong { font-size:1.05rem; letter-spacing:.02em; line-height:1.25; }
.economics-analysis-grid { display:grid; grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr); gap:1rem; align-items:stretch; }
.economics-analysis-grid > .dss-card { color:#263238; }
.economics-price-chip {
  align-self: center;
  padding: .35rem .65rem;
  border-radius: 999px;
  background: #e3f2fd;
  color: #0d47a1;
  font-size: .82rem;
}
.economics-stack { height: 18px; margin: 1rem 0 .85rem; }
.economics-legend { list-style: none; margin: 0; padding: 0; }
.economics-legend li {
  display: grid;
  grid-template-columns: 10px 1fr auto;
  align-items: center;
  gap: .65rem;
  padding: .55rem 0;
  border-bottom: 1px solid #eef2f6;
  font-size: .9rem;
}
.economics-legend i { width: 10px; height: 10px; border-radius: 99px; }
.economics-legend span { color: #546e7a; }
.economics-legend strong { color: #263238; }
.economics-legend__total {
  grid-template-columns: 1fr auto;
  border-bottom: 0;
  padding-top: .8rem;
  font-weight: 800;
}
.economics-legend__total span, .economics-legend__total strong { color: #0d47a1; }
.economics-decision { display: flex; flex-direction: column; }
.economics-decision__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: .75rem 1rem;
  margin-bottom: .85rem;
}
.economics-decision__badge {
  flex: 0 0 auto;
  max-width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: .38rem .7rem;
  border-radius: 999px;
  background: #e3f2fd;
  color: #0d47a1;
  font-size: .72rem;
  font-weight: 800;
  letter-spacing: .02em;
  white-space: nowrap;
}
.economics-decision__badge--test { background: #fff8e1; color: #e65100; }
.economics-decision__badge--fix { background: #ffebee; color: #b71c1c; }
.economics-decision__badge--scale { background: #e8f5e9; color: #1b5e20; }
.economics-decision h2 { margin: 0 0 .45rem; color:#17324d; font-size:1.18rem; line-height:1.35; }
.economics-decision p { margin: 0; color:#455a64; line-height:1.65; }
.economics-decision dl { margin:1.1rem 0 .85rem; }
.economics-decision dl div { display:flex; justify-content:space-between; gap:1rem; padding:.65rem 0; border-bottom:1px solid #e3e8ef; }
.economics-decision dt { color:#546e7a; }
.economics-decision dd { margin:0; color:#263238; font-weight:800; text-align:right; }
.economics-decision > small { display:block; margin-top: auto; color:#607d8b; line-height:1.5; }
.economics-decision--scale { border-color:#a5d6a7; }
.economics-decision--test { border-color:#ffe082; }
.economics-decision--fix { border-color:#ef9a9a; }
.economics-empty { display:flex; align-items:center; gap:1rem; color:#607d8b; }
.economics-empty > span { display:grid; place-items:center; width:48px; height:48px; flex:0 0 auto; border-radius:14px; background:#e3f2fd; color:#1565c0; font-size:1.4rem; }
.economics-empty h2 { margin:0 0 .3rem; color:#263238; font-size:1rem; }
.economics-empty p { margin:0; }
@media (max-width:1050px) {
  .economics-hero, .economics-analysis-grid { grid-template-columns: 1fr; }
  .economics-cost-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
  .economics-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); }
}
@media (max-width:760px) {
  .economics-product-grid,.economics-cost-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .economics-product-field { grid-column:1/-1; }
}
@media (max-width:620px) {
  .economics-section-head, .economics-decision__head { align-items:flex-start; flex-direction:column; }
  .economics-product-grid,.economics-cost-grid,.economics-kpis { grid-template-columns:1fr; }
  .economics-product-field { grid-column:auto; }
  .economics-decision__badge { white-space: normal; }
}
</style>
