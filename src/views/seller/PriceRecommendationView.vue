<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import PriceQuantityChart from '@/components/dss/PriceQuantityChart.vue'
import { apiConfig } from '@/api/config'
import { dssApi, productApi } from '@/api/services'
import { useAuthStore } from '@/stores/auth'
import {
  PRICE_PRODUCTS,
  defaultPriceRecommendation,
  generatePriceRecommendation,
  type PriceProductOption,
  type PriceRecommendationResult,
} from '@/utils/dssPriceMock'

const auth = useAuthStore()
const products = ref<PriceProductOption[]>([...PRICE_PRODUCTS])
const productId = ref(PRICE_PRODUCTS.find((p) => p.id === '1')?.id ?? PRICE_PRODUCTS[0].id)
const fromDate = ref('')
const toDate = ref('')
const result = ref<PriceRecommendationResult | null>(null)
const usingApi = ref(false)
const loading = ref(false)
const errorMsg = ref('')

const selectedProduct = computed(
  () => products.value.find((p) => p.id === productId.value) ?? products.value[0],
)

const isUsd = computed(() => selectedProduct.value?.id === 'p100')

function money(n: number) {
  if (isUsd.value) return `$${n.toLocaleString('en-US')}`
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(n)
}

function changePctLabel(pct: number) {
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct}%`
}

async function generate() {
  const product = selectedProduct.value
  if (!product) return
  errorMsg.value = ''

  if (usingApi.value) {
    loading.value = true
    try {
      const api = await dssApi.recommendPrice(product.id, 30)
      const action =
        api.action === 'increase' || api.action === 'decrease' || api.action === 'keep'
          ? api.action
          : 'keep'
      result.value = {
        productName: api.productName,
        currentPrice: Number(api.currentPrice),
        recommendedPrice: Number(api.recommendedPrice),
        priceChangePct: api.priceChangePct,
        priceElasticity: api.elasticity,
        currentDemand: api.currentDemand,
        predictedDemand: api.predictedDemand,
        expectedRevenue: Number(api.expectedRevenue),
        recommendationAction: action,
        recommendationMessage: api.message,
        insightTitle:
          action === 'increase'
            ? 'Nên tăng giá bán'
            : action === 'decrease'
              ? 'Nên giảm giá bán'
              : 'Giữ giá hiện tại',
        insightBody: api.insight,
        history: (api.chart ?? []).map((c, i) => ({
          date: c.label || `D-${i}`,
          averagePrice: Number(c.averagePrice),
          quantitySold: Number(c.quantitySold),
          elasticity: api.elasticity,
        })),
        chart: (api.chart ?? []).map((c) => ({
          label: c.label,
          averagePrice: Number(c.averagePrice),
          quantitySold: Number(c.quantitySold),
        })),
      }
      return
    } catch (e) {
      errorMsg.value = e instanceof Error ? e.message : 'Không gọi được DSS API'
    } finally {
      loading.value = false
    }
  }

  result.value = generatePriceRecommendation({
    product,
    fromDate: fromDate.value,
    toDate: toDate.value,
  })
}

onMounted(async () => {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  toDate.value = to.toISOString().slice(0, 10)
  fromDate.value = from.toISOString().slice(0, 10)

  if (apiConfig.useRealSeller && auth.isLoggedIn) {
    try {
      const sellerKey = auth.user?.backendId ?? auth.user?.id
      const list = await productApi.list({ sellerId: sellerKey, withStock: false })
      if (list.length) {
        products.value = list.map((p) => ({
          id: String(p.id),
          name: p.name,
          currentPrice: p.price,
        }))
        productId.value = products.value[0].id
        usingApi.value = true
        await generate()
        return
      }
    } catch {
      /* mock */
    }
  }

  result.value = defaultPriceRecommendation()
})
</script>

<template>
  <div class="dss-page">
    <header class="dss-page__header">
      <nav class="dss-crumb">
        <RouterLink to="/seller/products">Bảng điều khiển người bán</RouterLink>
        <span>/</span>
        <RouterLink to="/seller/dss">DSS</RouterLink>
        <span>/</span>
        <span>Gợi ý giá</span>
      </nav>
      <h1>Tạo gợi ý giá bán</h1>
      <p class="dss-page__sub">
        Phân tích độ co giãn giá và đề xuất mức giá tối ưu từ doanh số lịch sử.
      </p>
    </header>

    <section v-if="errorMsg" class="dss-warn-card">
      <h2>{{ errorMsg }}</h2>
    </section>

    <section class="dss-card">
      <h2 class="dss-card__title">Bộ lọc</h2>
      <div class="dss-form-grid dss-form-grid--4">
        <label class="dss-field">
          <span>Sản phẩm</span>
          <select v-model="productId" class="dss-input">
            <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <label class="dss-field">
          <span>Từ ngày</span>
          <input v-model="fromDate" type="date" class="dss-input" :disabled="usingApi" />
        </label>
        <label class="dss-field">
          <span>Đến ngày</span>
          <input v-model="toDate" type="date" class="dss-input" :disabled="usingApi" />
        </label>
        <div class="dss-field dss-field--action">
          <span>&nbsp;</span>
          <button
            type="button"
            class="dss-btn dss-btn--primary"
            :disabled="loading"
            @click="generate"
          >
            {{ loading ? 'Đang tạo…' : 'Tạo gợi ý giá' }}
          </button>
        </div>
      </div>
    </section>

    <template v-if="result">
      <section class="dss-kpi-grid dss-kpi-grid--5">
        <article class="dss-kpi">
          <span class="dss-kpi__label">Giá hiện tại</span>
          <strong>{{ money(result.currentPrice) }}</strong>
        </article>
        <article class="dss-kpi dss-kpi--accent">
          <span class="dss-kpi__label">Giá đề xuất</span>
          <strong>{{ money(result.recommendedPrice) }}</strong>
        </article>
        <article class="dss-kpi">
          <span class="dss-kpi__label">Thay đổi giá (%)</span>
          <strong class="dss-pos">{{ changePctLabel(result.priceChangePct) }}</strong>
        </article>
        <article class="dss-kpi">
          <span class="dss-kpi__label">Độ co giãn giá</span>
          <strong>{{ result.priceElasticity }}</strong>
        </article>
        <article class="dss-kpi">
          <span class="dss-kpi__label">Doanh thu kỳ vọng</span>
          <strong>{{ money(result.expectedRevenue) }}</strong>
        </article>
      </section>

      <div class="dss-two-col">
        <section class="dss-card">
          <h2 class="dss-card__title">Kết quả gợi ý</h2>
          <p class="dss-meta"><span>Giá hiện tại</span>{{ money(result.currentPrice) }}</p>
          <p class="dss-meta"><span>Giá đề xuất</span>{{ money(result.recommendedPrice) }}</p>
          <p class="dss-meta"><span>Nhu cầu ước tính</span>{{ result.predictedDemand }} đơn vị</p>
          <p class="dss-meta"><span>Nhu cầu hiện tại</span>{{ result.currentDemand }} đơn vị</p>
          <p class="dss-meta"><span>Doanh thu kỳ vọng</span>{{ money(result.expectedRevenue) }}</p>
          <p class="dss-meta"><span>Độ co giãn giá</span>{{ result.priceElasticity }}</p>
          <div class="dss-msg">
            <strong>Thông điệp gợi ý</strong>
            <p>{{ result.recommendationMessage }}</p>
          </div>
        </section>

        <section class="dss-card dss-insight" :class="`dss-insight--${result.recommendationAction}`">
          <h2 class="dss-card__title">Nhận định</h2>
          <p class="dss-insight__badge">{{ result.insightTitle }}</p>
          <p>{{ result.insightBody }}</p>
          <ul>
            <li>Nhu cầu: {{ result.currentDemand }} → {{ result.predictedDemand }} đơn vị</li>
            <li>Ưu tiên doanh thu hơn sản lượng</li>
            <li>Độ co giãn {{ result.priceElasticity }}</li>
          </ul>
        </section>
      </div>

      <section class="dss-card">
        <h2 class="dss-card__title">Giá bán trung bình vs Số lượng bán</h2>
        <p class="dss-hint">
          Biểu đồ 2 trục: khi giá tăng, số lượng bán thường giảm — cơ sở tính độ co giãn.
        </p>
        <PriceQuantityChart :data="result.chart" />
      </section>

      <section class="dss-card">
        <h2 class="dss-card__title">Dữ liệu lịch sử</h2>
        <div class="dss-table-wrap">
          <table class="dss-table">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Giá TB</th>
                <th>Số lượng bán</th>
                <th>Độ co giãn</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in result.history" :key="row.date">
                <td>{{ row.date }}</td>
                <td>{{ money(row.averagePrice) }}</td>
                <td>{{ row.quantitySold }}</td>
                <td>{{ row.elasticity }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
