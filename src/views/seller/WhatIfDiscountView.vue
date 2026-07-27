<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import WhatIfDemandBarChart from '@/components/dss/WhatIfDemandBarChart.vue'
import WhatIfProfitBarChart from '@/components/dss/WhatIfProfitBarChart.vue'
import WhatIfBreakEvenLineChart from '@/components/dss/WhatIfBreakEvenLineChart.vue'
import {
  WHATIF_PRODUCTS,
  SIM_PERIOD_OPTIONS,
  defaultSellerWhatIf,
  generateSellerWhatIf,
  formatUsd,
  type SellerWhatIfResult,
  type SimPeriodKey,
} from '@/utils/dssSellerWhatIfMock'

const productId = ref('coffee')
const discountPct = ref(10)
const periodKey = ref<SimPeriodKey>('30')
const result = ref<SellerWhatIfResult | null>(null)
const running = ref(false)

const selectedProduct = computed(
  () => WHATIF_PRODUCTS.find((p) => p.id === productId.value) ?? WHATIF_PRODUCTS[0],
)

function runAnalysis() {
  running.value = true
  window.setTimeout(() => {
    result.value = generateSellerWhatIf({
      productId: productId.value,
      discountPct: discountPct.value,
      periodKey: periodKey.value,
    })
    running.value = false
  }, 350)
}

onMounted(() => {
  result.value = defaultSellerWhatIf()
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
        <span>What-if · Giảm giá & lợi nhuận</span>
      </nav>
      <h1>Phân tích What-if — Giảm giá & lợi nhuận</h1>
      <p class="dss-page__sub">
        Đánh giá xem giảm giá sản phẩm có đáng không bằng cách ước lượng số lượng cần bán để giữ mức lợi nhuận hiện tại.
      </p>
    </header>

    <section class="dss-card">
      <h2 class="dss-card__title">Tham số mô phỏng</h2>
      <div class="dss-form-grid">
        <label class="dss-field">
          <span>Sản phẩm</span>
          <select v-model="productId" class="dss-input">
            <option v-for="p in WHATIF_PRODUCTS" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <label class="dss-field">
          <span>Kỳ mô phỏng</span>
          <select v-model="periodKey" class="dss-input">
            <option v-for="p in SIM_PERIOD_OPTIONS" :key="p.value" :value="p.value">
              {{ p.label }}
            </option>
          </select>
        </label>
        <label class="dss-field dss-field--span2">
          <span>Mức giảm giá: <strong>{{ discountPct }}%</strong></span>
          <input
            v-model.number="discountPct"
            type="range"
            min="0"
            max="30"
            step="1"
            class="dss-slider"
          />
          <span class="dss-hint">Khoảng 0% – 30%</span>
        </label>
      </div>

      <div class="dss-readonly-grid">
        <article class="dss-readonly">
          <span>Giá hiện tại</span>
          <strong>{{ formatUsd(selectedProduct.currentPrice) }}</strong>
        </article>
        <article class="dss-readonly">
          <span>Giá vốn / đơn vị</span>
          <strong>{{ formatUsd(selectedProduct.unitCost) }}</strong>
        </article>
        <article class="dss-readonly">
          <span>Nhu cầu dự báo hiện tại</span>
          <strong>{{ selectedProduct.forecastDemand }} đơn vị</strong>
        </article>
        <article class="dss-readonly">
          <span>Lợi nhuận tháng hiện tại</span>
          <strong>{{ formatUsd(selectedProduct.monthlyProfit) }}</strong>
        </article>
      </div>

      <button
        type="button"
        class="dss-btn dss-btn--primary"
        :disabled="running"
        @click="runAnalysis"
      >
        {{ running ? 'Đang chạy…' : 'Chạy phân tích' }}
      </button>
    </section>

    <template v-if="result">
      <section class="dss-kpi-grid dss-kpi-grid--6">
        <article class="dss-kpi dss-kpi--accent">
          <span class="dss-kpi__label">Giá mới dự kiến</span>
          <strong>{{ formatUsd(result.predictedNewPrice) }}</strong>
        </article>
        <article class="dss-kpi">
          <span class="dss-kpi__label">Nhu cầu dự báo</span>
          <strong>{{ result.predictedDemand }} đơn vị</strong>
        </article>
        <article class="dss-kpi">
          <span class="dss-kpi__label">Doanh thu kỳ vọng</span>
          <strong>{{ formatUsd(result.expectedRevenue) }}</strong>
        </article>
        <article class="dss-kpi">
          <span class="dss-kpi__label">Lợi nhuận kỳ vọng</span>
          <strong>{{ formatUsd(result.expectedProfit) }}</strong>
        </article>
        <article class="dss-kpi">
          <span class="dss-kpi__label">Số lượng hòa vốn</span>
          <strong>{{ result.breakEvenQuantity }} đơn vị</strong>
        </article>
        <article class="dss-kpi">
          <span class="dss-kpi__label">Cần bán thêm</span>
          <strong>{{ result.additionalUnitsRequired }} đơn vị</strong>
        </article>
      </section>

      <section class="dss-card dss-insight dss-insight--warn">
        <h2 class="dss-card__title">Nhận định AI</h2>
        <p class="dss-insight__badge">What-if · Giảm {{ result.discountPct }}%</p>
        <p>{{ result.insight }}</p>
        <p class="dss-hint">Tạo lúc {{ result.generatedAt }} · Kỳ {{ result.periodLabel }} · {{ result.productName }}</p>
      </section>

      <div class="dss-two-col">
        <section class="dss-card">
          <h2 class="dss-card__title">Nhu cầu hiện tại vs dự báo</h2>
          <WhatIfDemandBarChart
            :current-demand="result.currentDemand"
            :predicted-demand="result.predictedDemand"
          />
        </section>
        <section class="dss-card">
          <h2 class="dss-card__title">Lợi nhuận hiện tại vs kỳ vọng</h2>
          <WhatIfProfitBarChart
            :current-profit="result.currentProfit"
            :expected-profit="result.expectedProfit"
          />
        </section>
      </div>

      <section class="dss-card">
        <h2 class="dss-card__title">Giảm giá (%) vs Số lượng hòa vốn</h2>
        <p class="dss-hint">Đường cong demo — số lượng cần bán để giữ lợi nhuận khi tăng mức giảm giá.</p>
        <WhatIfBreakEvenLineChart :series="result.breakEvenCurve" />
      </section>
    </template>
  </div>
</template>
