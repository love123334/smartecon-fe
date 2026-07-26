<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { dssApi } from '@/api/services'
import type { DssInsight } from '@/types'
import { useAuthStore } from '@/stores/auth'
import HybridDataNotice from '@/components/HybridDataNotice.vue'
import PageHeader from '@/components/PageHeader.vue'
import AiShortcutBar from '@/components/AiShortcutBar.vue'

const auth = useAuthStore()
const insights = ref<DssInsight[]>([])

const sellerKey = computed(() => auth.user?.backendId ?? auth.user?.id)

onMounted(async () => {
  insights.value = await dssApi.sellerInsights(sellerKey.value)
})
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Người bán"
      title="Hỗ trợ quyết định (DSS)"
      lead="Dự báo nhu cầu (Moving Average) và gợi ý giá dựa trên độ co giãn — dashboard analytics."
    />
    <AiShortcutBar
      title="Tiếp theo:"
      :links="[
        { to: '/seller/dss/demand', label: 'Demand Prediction', highlight: true },
        { to: '/seller/dss/price', label: 'Price Recommendation', highlight: true },
        { to: '/seller/chatbot', label: 'Trợ lý AI' },
        { to: '/seller/sales', label: 'Bảng doanh số' },
      ]"
    />
    <HybridDataNotice
      message="Demand Prediction & Price Recommendation đang dùng mock DSS (FE). Tồn kho / insights khác có thể lấy từ API seller khi đăng nhập."
    />

    <div class="dss-hub">
      <RouterLink class="dss-hub__card" to="/seller/dss/demand">
        <span class="dss-hub__tag">Forecast</span>
        <h2>Demand Prediction</h2>
        <p>Moving Average · Next 7/30/90 days · trend chart + KPI cards.</p>
        <span class="dss-hub__cta">Open →</span>
      </RouterLink>
      <RouterLink class="dss-hub__card" to="/seller/dss/price">
        <span class="dss-hub__tag">Pricing</span>
        <h2>Price Recommendation</h2>
        <p>Elasticity · dual-axis price/qty chart · history table · revenue impact.</p>
        <span class="dss-hub__cta">Open →</span>
      </RouterLink>
    </div>

    <h3 class="dss-hub__section">Quick insights</h3>
    <div class="grid grid-2">
      <article v-for="i in insights" :key="i.id" class="card insight">
        <span :class="['impact', i.impact]">{{ i.impact }}</span>
        <h3>{{ i.title }}</h3>
        <p>{{ i.description }}</p>
        <small>{{ i.category }}</small>
      </article>
    </div>
  </div>
</template>

<style scoped>
.dss-hub {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.dss-hub__card {
  display: block;
  padding: 1.25rem 1.35rem;
  border-radius: 12px;
  border: 1px solid #e3e8ef;
  background: #fff;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.08);
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.dss-hub__card:hover {
  border-color: #90caf9;
  box-shadow: 0 4px 14px rgba(25, 118, 210, 0.14);
}
.dss-hub__tag {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #1565c0;
  background: #e3f2fd;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
}
.dss-hub__card h2 {
  margin: 0.6rem 0 0.35rem;
  font-size: 1.2rem;
  color: #0d47a1;
}
.dss-hub__card p {
  margin: 0;
  color: #607d8b;
  font-size: 0.92rem;
  line-height: 1.45;
}
.dss-hub__cta {
  display: inline-block;
  margin-top: 0.85rem;
  font-weight: 700;
  color: #1976d2;
}
.dss-hub__section {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  color: #455a64;
}
.insight h3 {
  margin: 0.5rem 0 0.35rem;
}
.impact {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
}
.impact.high {
  background: #fee2e2;
  color: #991b1b;
}
.impact.medium {
  background: #fef3c7;
  color: #92400e;
}
.impact.low {
  background: #d1fae5;
  color: #065f46;
}
@media (max-width: 720px) {
  .dss-hub {
    grid-template-columns: 1fr;
  }
}
</style>
