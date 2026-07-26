<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import PriceQuantityChart from '@/components/dss/PriceQuantityChart.vue'
import {
  PRICE_PRODUCTS,
  defaultPriceRecommendation,
  generatePriceRecommendation,
  type PriceRecommendationResult,
} from '@/utils/dssPriceMock'

const productId = ref(PRICE_PRODUCTS.find((p) => p.id === 'p100')?.id ?? PRICE_PRODUCTS[0].id)
const fromDate = ref('')
const toDate = ref('')
const result = ref<PriceRecommendationResult | null>(null)

const selectedProduct = computed(
  () => PRICE_PRODUCTS.find((p) => p.id === productId.value) ?? PRICE_PRODUCTS[0],
)

const isUsd = computed(() => selectedProduct.value?.id === 'p100')

function money(n: number) {
  if (isUsd.value) return `$${n.toLocaleString('en-US')}`
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n)
}

function generate() {
  const product = selectedProduct.value
  if (!product) return
  result.value = generatePriceRecommendation({
    product,
    fromDate: fromDate.value,
    toDate: toDate.value,
  })
}

onMounted(() => {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  toDate.value = to.toISOString().slice(0, 10)
  fromDate.value = from.toISOString().slice(0, 10)
  result.value = defaultPriceRecommendation()
})
</script>

<template>
  <div class="dss-page">
    <header class="dss-page__header">
      <nav class="dss-crumb">
        <RouterLink to="/seller/products">Seller Dashboard</RouterLink>
        <span>/</span>
        <RouterLink to="/seller/dss">DSS</RouterLink>
        <span>/</span>
        <span>Price Recommendation</span>
      </nav>
      <h1>Generate Price Recommendation</h1>
      <p class="dss-page__sub">
        Analyze price elasticity and recommend an optimal selling price from historical sales.
      </p>
    </header>

    <!-- Filters -->
    <section class="dss-card">
      <h2 class="dss-card__title">Filters</h2>
      <div class="dss-form-grid dss-form-grid--4">
        <label class="dss-field">
          <span>Product</span>
          <select v-model="productId" class="dss-input">
            <option v-for="p in PRICE_PRODUCTS" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <label class="dss-field">
          <span>From Date</span>
          <input v-model="fromDate" type="date" class="dss-input" />
        </label>
        <label class="dss-field">
          <span>To Date</span>
          <input v-model="toDate" type="date" class="dss-input" />
        </label>
        <div class="dss-field dss-field--action">
          <span>&nbsp;</span>
          <button type="button" class="dss-btn dss-btn--primary" @click="generate">
            Generate Recommendation
          </button>
        </div>
      </div>
    </section>

    <template v-if="result">
      <!-- KPI -->
      <section class="dss-kpi-grid dss-kpi-grid--5">
        <article class="dss-kpi">
          <span class="dss-kpi__label">Current Price</span>
          <strong>{{ money(result.currentPrice) }}</strong>
        </article>
        <article class="dss-kpi dss-kpi--accent">
          <span class="dss-kpi__label">Recommended Price</span>
          <strong>{{ money(result.recommendedPrice) }}</strong>
        </article>
        <article class="dss-kpi">
          <span class="dss-kpi__label">Price Change (%)</span>
          <strong class="dss-pos">+{{ result.priceChangePct }}%</strong>
        </article>
        <article class="dss-kpi">
          <span class="dss-kpi__label">Price Elasticity</span>
          <strong>{{ result.priceElasticity }}</strong>
        </article>
        <article class="dss-kpi">
          <span class="dss-kpi__label">Expected Revenue</span>
          <strong>{{ money(result.expectedRevenue) }}</strong>
        </article>
      </section>

      <div class="dss-two-col">
        <!-- Result -->
        <section class="dss-card">
          <h2 class="dss-card__title">Recommendation Result</h2>
          <p class="dss-meta"><span>Current Price</span>{{ money(result.currentPrice) }}</p>
          <p class="dss-meta"><span>Recommended Price</span>{{ money(result.recommendedPrice) }}</p>
          <p class="dss-meta"><span>Estimated Demand</span>{{ result.predictedDemand }} units</p>
          <p class="dss-meta"><span>Current Demand</span>{{ result.currentDemand }} units</p>
          <p class="dss-meta"><span>Expected Revenue</span>{{ money(result.expectedRevenue) }}</p>
          <p class="dss-meta"><span>Price Elasticity</span>{{ result.priceElasticity }}</p>
          <div class="dss-msg">
            <strong>Recommendation Message</strong>
            <p>{{ result.recommendationMessage }}</p>
          </div>
        </section>

        <!-- Insight -->
        <section class="dss-card dss-insight" :class="`dss-insight--${result.recommendationAction}`">
          <h2 class="dss-card__title">Recommendation Insight</h2>
          <p class="dss-insight__badge">{{ result.insightTitle }}</p>
          <p>{{ result.insightBody }}</p>
          <ul>
            <li>Demand: {{ result.currentDemand }} → {{ result.predictedDemand }} units</li>
            <li>Revenue impact prioritized over volume</li>
            <li>Elasticity {{ result.priceElasticity }} (relatively inelastic)</li>
          </ul>
        </section>
      </div>

      <!-- Chart -->
      <section class="dss-card">
        <h2 class="dss-card__title">Price vs Quantity Sold</h2>
        <p class="dss-hint">
          Dual-axis chart: when price rises, quantity sold tends to fall — basis for elasticity.
        </p>
        <PriceQuantityChart :data="result.chart" />
      </section>

      <!-- History -->
      <section class="dss-card">
        <h2 class="dss-card__title">History Data</h2>
        <div class="dss-table-wrap">
          <table class="dss-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Average Price</th>
                <th>Quantity Sold</th>
                <th>Elasticity</th>
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
