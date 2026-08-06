<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import InventoryStockBarChart from '@/components/dss/InventoryStockBarChart.vue'
import InventorySalesTrendChart from '@/components/dss/InventorySalesTrendChart.vue'
import { apiConfig } from '@/api/config'
import { dssApi } from '@/api/services'
import { useAuthStore } from '@/stores/auth'
import { loadSellerCatalogForDss } from '@/utils/sellerCatalog'
import {
  INVENTORY_ERROR_MESSAGES,
  INVENTORY_PRODUCTS,
  PLANNING_PERIOD_OPTIONS,
  generateInventoryRecommendation,
  type InventoryErrorCode,
  type InventoryProductOption,
  type InventoryRecommendationResult,
  type PlanningPeriodKey,
} from '@/utils/dssInventoryMock'
import { buildInventoryAiInsight } from '@/utils/sellerDssModuleAi'

const auth = useAuthStore()
const products = ref<InventoryProductOption[]>(
  apiConfig.useRealSeller ? [{ id: 'all', name: 'Tất cả sản phẩm của tôi' }] : [...INVENTORY_PRODUCTS],
)
const productQuery = ref('')
const productId = ref('all')
const planningKey = ref<PlanningPeriodKey>('14')
const usingApi = ref(false)
const catalogError = ref('')

const loading = ref(false)
const success = ref(false)
const errorCode = ref<InventoryErrorCode | null>(null)
const apiError = ref('')
const result = ref<InventoryRecommendationResult | null>(null)

const filteredProducts = computed(() => {
  const q = productQuery.value.trim().toLowerCase()
  if (!q) return products.value
  return products.value.filter((p) => p.name.toLowerCase().includes(q))
})

const trendSeries = computed(() => result.value?.rows[0]?.historicalSales ?? [])
const hasTrend = computed(() => trendSeries.value.length > 0)

const aiInsight = computed(() => {
  if (!result.value) return null
  const needRows = result.value.rows.filter((r) => r.status === 'need').length
  return buildInventoryAiInsight({
    focusProductName: result.value.focusProductName,
    overallStatus: result.value.overallStatus,
    recommendationMessage: result.value.recommendationMessage,
    currentStock: result.value.currentStock,
    reorderPoint: result.value.reorderPoint,
    recommendedOrderQuantity: result.value.recommendedOrderQuantity,
    averageDailyDemand: result.value.averageDailyDemand,
    needRowCount: needRows,
  })
})

onMounted(async () => {
  if (!(apiConfig.useRealSeller && auth.isLoggedIn)) return
  try {
    const sellerKey = auth.user?.backendId ?? auth.user?.id
    const { products: list, error } = await loadSellerCatalogForDss({
      sellerId: sellerKey,
      withStock: false,
    })
    if (error) {
      catalogError.value = error
      usingApi.value = false
      return
    }
    if (list.length) {
      products.value = [
        { id: 'all', name: 'Tất cả sản phẩm của tôi' },
        ...list.map((p) => ({ id: String(p.id), name: p.name })),
      ]
      productId.value = 'all'
      usingApi.value = true
      catalogError.value = ''
    } else {
      catalogError.value = 'Bạn chưa có sản phẩm nào để tạo khuyến nghị tồn kho.'
    }
  } catch (e) {
    catalogError.value = e instanceof Error ? e.message : 'Không tải được danh sách sản phẩm.'
    usingApi.value = false
  }
})

async function generate() {
  success.value = false
  errorCode.value = null
  apiError.value = ''
  result.value = null
  loading.value = true

  const planning = PLANNING_PERIOD_OPTIONS.find((o) => o.value === planningKey.value)!

  if (apiConfig.useRealSeller && !usingApi.value) {
    apiError.value =
      catalogError.value ||
      'Chưa kết nối được catalog backend — không chạy mô phỏng demo khi đang ở chế độ API thật.'
    errorCode.value = 'failed'
    loading.value = false
    return
  }

  if (usingApi.value) {
    try {
      const api = await dssApi.recommendInventory(
        planning.days,
        productId.value === 'all' ? undefined : productId.value,
      )
      const rows = (api.rows ?? []).map((r) => ({
        productId: String(r.productId),
        productName: r.productName,
        currentStock: Number(r.currentStock),
        averageDailyDemand: Number(r.averageDailyDemand),
        leadTimeDays: Number(r.leadTimeDays),
        safetyStock: Number(r.safetyStock),
        reorderPoint: Number(r.reorderPoint),
        recommendedOrder: Number(r.recommendedOrder),
        status: (r.status === 'need' ? 'need' : 'sufficient') as 'need' | 'sufficient',
        statusLabel: r.statusLabel,
        historicalSales: [] as { day: number; qty: number }[],
      }))
      if (!rows.length) {
        errorCode.value = 'failed'
        apiError.value = 'Backend không trả về dòng khuyến nghị nào.'
        return
      }
      const focus = rows[0]
      const overallStatus = api.overallStatus === 'need' ? 'need' : 'sufficient'
      result.value = {
        planningLabel: planning.label,
        planningDays: api.planningDays,
        focusProductName:
          productId.value === 'all' ? 'Tất cả sản phẩm' : focus.productName,
        currentStock: focus.currentStock,
        averageDailyDemand: focus.averageDailyDemand,
        reorderPoint: focus.reorderPoint,
        recommendedOrderQuantity: focus.recommendedOrder,
        overallStatus,
        overallStatusLabel: overallStatus === 'need' ? 'Cần bổ sung' : 'Tồn kho đủ',
        recommendationMessage: api.recommendationMessage,
        rows,
        generatedAt: api.generatedAt,
      }
      success.value = true
      return
    } catch (e) {
      apiError.value = e instanceof Error ? e.message : 'Không gọi được DSS API'
      errorCode.value = 'failed'
      return
    } finally {
      loading.value = false
    }
  }

  await new Promise((r) => setTimeout(r, 400))
  const out = generateInventoryRecommendation({
    productId: productId.value,
    planningKey: planningKey.value,
  })
  loading.value = false

  if (!out.ok) {
    errorCode.value = out.error
    return
  }

  result.value = out.data
  success.value = true
}

function clearError() {
  errorCode.value = null
  apiError.value = ''
}
</script>

<template>
  <div class="dss-page">
    <header class="dss-page__header">
      <nav class="dss-crumb">
        <RouterLink to="/seller/products">Bảng điều khiển người bán</RouterLink>
        <span>/</span>
        <RouterLink to="/seller/dss">DSS</RouterLink>
        <span>/</span>
        <span>Khuyến nghị tồn kho</span>
      </nav>
      <h1>Khuyến nghị tồn kho</h1>
      <p class="dss-page__sub">
        Tạo khuyến nghị bổ sung hàng dựa trên doanh số lịch sử và tồn kho hiện tại (điểm đặt hàng lại /
        ROP).
      </p>
    </header>

    <div v-if="catalogError" class="dss-alert dss-alert--warn" role="alert">
      {{ catalogError }}
    </div>

    <div v-if="errorCode" class="dss-alert dss-alert--warn" role="alert">
      <p style="margin: 0 0 0.5rem">{{ apiError || INVENTORY_ERROR_MESSAGES[errorCode] }}</p>
      <button type="button" class="dss-btn dss-btn--outline" @click="clearError">Đóng</button>
    </div>

    <section class="dss-card">
        <h2 class="dss-card__title">Cấu hình</h2>
        <div class="dss-form-grid dss-form-grid--3">
          <label class="dss-field">
            <span>Sản phẩm</span>
            <input
              v-model="productQuery"
              type="search"
              class="dss-input"
              placeholder="Tìm sản phẩm…"
            />
            <select v-model="productId" class="dss-input">
              <option v-for="p in filteredProducts" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </label>
          <label class="dss-field">
            <span>Kỳ hoạch định</span>
            <select v-model="planningKey" class="dss-input">
              <option v-for="o in PLANNING_PERIOD_OPTIONS" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </select>
          </label>
          <div class="dss-field dss-field--action">
            <span>&nbsp;</span>
            <button
              type="button"
              class="dss-btn dss-btn--primary"
              :disabled="loading"
              @click="generate"
            >
              {{ loading ? 'Đang tạo…' : 'Tạo khuyến nghị' }}
            </button>
          </div>
        </div>
      </section>

      <div v-if="success" class="dss-alert dss-alert--success" role="status">
        Tạo khuyến nghị tồn kho thành công.
      </div>

      <template v-if="loading">
        <section class="dss-kpi-grid">
          <div v-for="n in 4" :key="n" class="dss-skel dss-skel--kpi" />
        </section>
        <div class="dss-skel dss-skel--panel" />
      </template>

      <section v-else-if="!result" class="dss-empty">
        <div class="dss-empty__art" aria-hidden="true">📦</div>
        <h2>Chưa có khuyến nghị tồn kho</h2>
        <p>Chọn sản phẩm và kỳ hoạch định, rồi nhấn <strong>Tạo khuyến nghị</strong>.</p>
      </section>

      <template v-else>
        <section class="dss-kpi-grid">
          <article class="dss-kpi">
            <span class="dss-kpi__label">Tồn kho hiện tại</span>
            <strong>{{ result.currentStock }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Nhu cầu TB / ngày</span>
            <strong>{{ result.averageDailyDemand }}</strong>
          </article>
          <article class="dss-kpi">
            <span class="dss-kpi__label">Điểm đặt hàng lại</span>
            <strong>{{ result.reorderPoint }}</strong>
          </article>
          <article class="dss-kpi dss-kpi--accent">
            <span class="dss-kpi__label">SL đề xuất nhập</span>
            <strong>{{ result.recommendedOrderQuantity }}</strong>
          </article>
        </section>

        <section class="dss-card dss-status-panel" :class="`dss-status-panel--${result.overallStatus}`">
          <h2 class="dss-card__title">Trạng thái khuyến nghị</h2>
          <span
            class="dss-badge"
            :class="result.overallStatus === 'need' ? 'dss-badge--danger' : 'dss-badge--success'"
          >
            {{ result.overallStatusLabel }}
          </span>
          <p class="dss-status-panel__msg">{{ result.recommendationMessage }}</p>
          <p class="dss-hint">
            Sản phẩm trọng tâm: {{ result.focusProductName }} · Kỳ: {{ result.planningLabel }} · Tạo lúc
            {{ result.generatedAt }}
          </p>
        </section>

        <section
          v-if="aiInsight"
          class="dss-card dss-ai-panel"
          :class="`dss-ai-panel--${aiInsight.tone}`"
          aria-labelledby="inventory-ai-title"
        >
          <div class="dss-ai-panel__head">
            <div>
              <span class="dss-ai-panel__badge">{{ aiInsight.badge }}</span>
              <h2 id="inventory-ai-title" class="dss-card__title" style="margin: 0">Nhận định AI</h2>
            </div>
            <p class="dss-ai-panel__method">ROP · safety stock · nhu cầu TB</p>
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

        <section class="dss-card">
          <h2 class="dss-card__title">Bảng khuyến nghị chi tiết</h2>
          <div class="dss-table-wrap">
            <table class="dss-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Tồn hiện tại</th>
                  <th>Nhu cầu TB/ngày</th>
                  <th>Lead time</th>
                  <th>Safety stock</th>
                  <th>ROP</th>
                  <th>SL đề xuất</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in result.rows" :key="row.productId">
                  <td>{{ row.productName }}</td>
                  <td>{{ row.currentStock }}</td>
                  <td>{{ row.averageDailyDemand }}</td>
                  <td>{{ row.leadTimeDays }} ngày</td>
                  <td>{{ row.safetyStock }}</td>
                  <td>{{ row.reorderPoint }}</td>
                  <td>{{ row.recommendedOrder }}</td>
                  <td>
                    <span
                      class="dss-badge"
                      :class="row.status === 'need' ? 'dss-badge--danger' : 'dss-badge--success'"
                    >
                      {{ row.statusLabel }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div class="dss-two-col">
          <section class="dss-card">
            <h2 class="dss-card__title">So sánh tồn kho · ROP · SL nhập</h2>
            <InventoryStockBarChart :rows="result.rows" />
          </section>
          <section class="dss-card">
            <h2 class="dss-card__title">Xu hướng bán hàng lịch sử</h2>
            <p class="dss-hint">Dùng để tính nhu cầu trung bình mỗi ngày (ADD).</p>
            <InventorySalesTrendChart
              v-if="hasTrend"
              :series="trendSeries"
              :product-name="result.rows[0]?.productName"
            />
            <p v-else class="dss-hint">
              Backend chưa trả chuỗi lịch sử bán — biểu đồ ẩn. Nhu cầu TB/ngày vẫn lấy từ API khuyến nghị.
            </p>
          </section>
        </div>
      </template>
  </div>
</template>
