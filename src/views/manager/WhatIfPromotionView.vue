<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import PromoDemandColumnChart from '@/components/dss/PromoDemandColumnChart.vue'
import PromoProfitLineChart from '@/components/dss/PromoProfitLineChart.vue'
import PromoRadarChart from '@/components/dss/PromoRadarChart.vue'
import {
  MANAGER_CATEGORIES,
  CAMPAIGN_DURATIONS,
  defaultManagerWhatIf,
  generateManagerWhatIf,
  formatUsd,
  type ManagerWhatIfResult,
  type CampaignDurationKey,
} from '@/utils/dssManagerWhatIfMock'

const category = ref('coffee')
const durationKey = ref<CampaignDurationKey>('7')
const result = ref<ManagerWhatIfResult | null>(null)
const running = ref(false)

function generate() {
  running.value = true
  window.setTimeout(() => {
    result.value = generateManagerWhatIf({
      category: category.value,
      durationKey: durationKey.value,
    })
    running.value = false
  }, 350)
}

onMounted(() => {
  result.value = defaultManagerWhatIf()
})
</script>

<template>
  <div class="dss-page">
    <header class="dss-page__header">
      <nav class="dss-crumb">
        <RouterLink to="/manager/dashboard">Bảng điều khiển quản lý</RouterLink>
        <span>/</span>
        <RouterLink to="/manager/dss">DSS</RouterLink>
        <span>/</span>
        <span>What-if · So sánh khuyến mãi</span>
      </nav>
      <h1>Phân tích What-if — So sánh kịch bản khuyến mãi</h1>
      <p class="dss-page__sub">
        So sánh nhiều mức giảm giá để chọn chiến lược khuyến mãi tối ưu cho chiến dịch trên sàn.
      </p>
    </header>

    <section class="dss-card">
      <h2 class="dss-card__title">Cấu hình chiến dịch</h2>
      <div class="dss-form-grid">
        <label class="dss-field">
          <span>Danh mục sản phẩm</span>
          <select v-model="category" class="dss-input">
            <option v-for="c in MANAGER_CATEGORIES" :key="c.value" :value="c.value">
              {{ c.label }}
            </option>
          </select>
        </label>
        <label class="dss-field">
          <span>Thời lượng chiến dịch</span>
          <select v-model="durationKey" class="dss-input">
            <option v-for="d in CAMPAIGN_DURATIONS" :key="d.value" :value="d.value">
              {{ d.label }}
            </option>
          </select>
        </label>
        <div class="dss-field dss-field--action">
          <span>&nbsp;</span>
          <button
            type="button"
            class="dss-btn dss-btn--primary"
            :disabled="running"
            @click="generate"
          >
            {{ running ? 'Đang tạo…' : 'Tạo kịch bản' }}
          </button>
        </div>
      </div>
    </section>

    <template v-if="result">
      <section class="dss-card">
        <h2 class="dss-card__title">Bảng so sánh kịch bản</h2>
        <p class="dss-hint">
          {{ result.categoryLabel }} · {{ result.durationLabel }} · cập nhật {{ result.generatedAt }}
        </p>
        <div class="dss-table-wrap">
          <table class="dss-table">
            <thead>
              <tr>
                <th>Giảm giá</th>
                <th>Nhu cầu dự báo</th>
                <th>Doanh thu</th>
                <th>Lợi nhuận</th>
                <th>Rủi ro tồn kho</th>
                <th>Khuyến nghị</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in result.rows"
                :key="row.discountPct"
                :class="{
                  'is-best': row.isBestBalance,
                  'is-rec': row.isRecommended && !row.isBestBalance,
                }"
              >
                <td><strong>{{ row.discountPct }}%</strong></td>
                <td>{{ row.predictedDemand }} đơn vị</td>
                <td>{{ formatUsd(row.revenue) }}</td>
                <td>{{ formatUsd(row.profit) }}</td>
                <td>
                  <span
                    class="dss-badge"
                    :class="{
                      'dss-badge--success': row.inventoryRisk === 'low',
                      'dss-badge--warn': row.inventoryRisk === 'medium',
                      'dss-badge--danger':
                        row.inventoryRisk === 'high' || row.inventoryRisk === 'very_high',
                    }"
                  >
                    {{ row.inventoryRiskLabel }}
                  </span>
                </td>
                <td>{{ row.recommendation }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div class="dss-two-col">
        <section class="dss-card dss-recommend-card">
          <h2 class="dss-card__title">Kịch bản được chọn</h2>
          <p class="dss-recommend-card__value">{{ result.recommendedDiscount }}%</p>
          <p class="dss-recommend-card__label">Mức giảm giá đề xuất</p>
          <p>{{ result.recommendedReason }}</p>
        </section>
        <section class="dss-card dss-insight">
          <h2 class="dss-card__title">Nhận định AI</h2>
          <p class="dss-insight__badge">Promotion What-if</p>
          <p>{{ result.insight }}</p>
        </section>
      </div>

      <div class="dss-two-col">
        <section class="dss-card">
          <h2 class="dss-card__title">Giảm giá vs Nhu cầu dự báo</h2>
          <PromoDemandColumnChart :rows="result.rows" />
        </section>
        <section class="dss-card">
          <h2 class="dss-card__title">Giảm giá vs Lợi nhuận</h2>
          <PromoProfitLineChart :rows="result.rows" />
        </section>
      </div>

      <section class="dss-card">
        <h2 class="dss-card__title">Radar — Tăng nhu cầu · Lợi nhuận · An toàn tồn kho</h2>
        <p class="dss-hint">So sánh đa tiêu chí giữa các mức giảm giá 5% / 10% / 15% / 20%.</p>
        <PromoRadarChart :radar="result.radar" />
      </section>
    </template>
  </div>
</template>

<style scoped>
.dss-table tbody tr.is-best {
  background: color-mix(in srgb, #e3f2fd 70%, white);
}
.dss-table tbody tr.is-rec {
  background: color-mix(in srgb, #e8f5e9 60%, white);
}
</style>
