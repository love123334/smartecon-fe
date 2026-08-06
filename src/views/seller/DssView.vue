<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { dssApi } from '@/api/services'
import type { DssInsight, Product } from '@/types'
import type { DssInsightPlanApi } from '@/api/real/dss'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'
import AiShortcutBar from '@/components/AiShortcutBar.vue'
import {
  buildSellerAiInsightsSummary,
  sanitizeDssCommentary,
} from '@/utils/dssCommentary'
import { buildSellerDssModuleCards } from '@/utils/sellerDssModuleAi'
import { loadSellerCatalogForDss } from '@/utils/sellerCatalog'

const auth = useAuthStore()
const insights = ref<DssInsight[]>([])
const products = ref<Product[]>([])
const plan = ref<DssInsightPlanApi | null>(null)
const planError = ref('')
const planLoading = ref(false)
const hubLoading = ref(true)

const sellerKey = computed(() => auth.user?.backendId ?? auth.user?.id)
const embedUrl = computed(() => plan.value?.powerBiEmbedUrl?.trim() || '')

const planCommentary = computed(() => {
  const raw = sanitizeDssCommentary(plan.value?.commentary || '')
  if (raw.trim().length > 40) return raw
  return sanitizeDssCommentary(buildSellerAiInsightsSummary(insights.value))
})

const commentarySections = computed(() => {
  const text = planCommentary.value
  const parts = text.split(/^##\s+/m).filter(Boolean)
  return parts.map((block) => {
    const nl = block.indexOf('\n')
    const title = (nl >= 0 ? block.slice(0, nl) : block).trim()
    const body = (nl >= 0 ? block.slice(nl + 1) : '').trim()
    return { title, body }
  })
})

const moduleCards = computed(() =>
  buildSellerDssModuleCards({
    insights: insights.value,
    products: products.value,
  }),
)

onMounted(async () => {
  hubLoading.value = true
  planLoading.value = true
  planError.value = ''
  try {
    const [ins, catalog, planRes] = await Promise.all([
      dssApi.sellerInsights(sellerKey.value),
      loadSellerCatalogForDss({ sellerId: sellerKey.value, withStock: true }),
      dssApi.insightPlan().catch((e: unknown) => {
        planError.value = e instanceof Error ? e.message : 'Không tải được kế hoạch DSS'
        return null
      }),
    ])
    insights.value = ins
    products.value = catalog.products
    if (planRes) plan.value = planRes
  } finally {
    hubLoading.value = false
    planLoading.value = false
  }
})
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Người bán"
      title="Hỗ trợ quyết định (DSS)"
      lead="Bốn module DSS kèm nhận định AI bám số liệu bán hàng / tồn kho của shop."
    />
    <AiShortcutBar
      title="Tiếp theo:"
      :links="[
        { to: '/seller/dss/demand', label: 'Dự báo nhu cầu', highlight: true },
        { to: '/seller/dss/price', label: 'Gợi ý giá', highlight: true },
        { to: '/seller/dss/what-if', label: 'What-if giảm giá', highlight: true },
      ]"
    />

    <section class="dss-brain" aria-labelledby="dss-ai-title">
      <div class="dss-brain__head">
        <h3 id="dss-ai-title">Nhận định AI &amp; kế hoạch</h3>
        <small v-if="plan">{{ plan.generatedAt }}</small>
      </div>
      <p v-if="planLoading" class="dss-brain__loading">Đang tổng hợp số liệu…</p>
      <p v-else-if="planError && !planCommentary" class="dss-brain__err">{{ planError }}</p>
      <div v-else class="dss-brain__body">
        <div v-if="commentarySections.length" class="dss-ai-sections">
          <article v-for="(sec, idx) in commentarySections" :key="idx" class="dss-ai-sec">
            <h4>{{ sec.title }}</h4>
            <pre class="dss-brain__md">{{ sec.body }}</pre>
          </article>
        </div>
        <pre v-else class="dss-brain__md">{{ planCommentary }}</pre>
        <iframe
          v-if="embedUrl"
          class="dss-brain__embed"
          :src="embedUrl"
          :title="plan?.powerBiReportTitle || 'Power BI'"
          allowfullscreen
        />
      </div>
    </section>

    <h3 class="dss-hub__section">Module DSS · nhận định AI theo shop</h3>
    <p v-if="hubLoading" class="muted" role="status">Đang đọc catalog &amp; insight…</p>
    <div v-else class="dss-hub">
      <RouterLink
        v-for="card in moduleCards"
        :key="card.key"
        class="dss-hub__card"
        :class="`dss-hub__card--${card.aiTone}`"
        :to="card.to"
      >
        <div class="dss-hub__top">
          <span class="dss-hub__tag">{{ card.tag }}</span>
          <span class="dss-hub__ai-badge" :class="`dss-hub__ai-badge--${card.aiTone}`">
            {{ card.aiBadge }}
          </span>
        </div>
        <h2>{{ card.title }}</h2>
        <p class="dss-hub__blurb">{{ card.blurb }}</p>
        <div class="dss-hub__ai">
          <strong>{{ card.aiTitle }}</strong>
          <span>{{ card.aiSummary }}</span>
        </div>
        <span class="dss-hub__cta">Mở module →</span>
      </RouterLink>
    </div>

    <h3 class="dss-hub__section">Gợi ý nhanh</h3>
    <div class="grid grid-2 insight-grid">
      <article v-for="i in insights" :key="i.id" class="card insight">
        <span :class="['impact', i.impact]">{{ i.priorityLabel || i.impact }}</span>
        <h3>{{ i.title }}</h3>
        <p>{{ i.description }}</p>
        <div class="insight__foot">
          <small>{{ i.category }}</small>
          <RouterLink
            v-if="i.actionUrl && i.actionLabel"
            :to="i.actionUrl"
            class="insight__action"
          >
            {{ i.actionLabel }} →
          </RouterLink>
        </div>
      </article>
      <p v-if="!insights.length" class="muted">Chưa có gợi ý dashboard — chạy các module DSS để có tín hiệu rõ hơn.</p>
    </div>
  </div>
</template>

<style scoped>
.dss-brain {
  margin-bottom: 1.5rem;
  padding: 1.15rem 1.25rem;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  background: linear-gradient(180deg, #f8fbff 0%, #fff 100%);
}
.dss-brain__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.dss-brain__head h3 {
  margin: 0;
  font-size: 1.05rem;
  color: #0d47a1;
}
.dss-brain__head small {
  color: #64748b;
}
.dss-ai-sections {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.dss-ai-sec {
  padding: 0.75rem 0.9rem;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #e8eef8;
}
.dss-ai-sec h4 {
  margin: 0 0 0.4rem;
  font-size: 0.9rem;
  color: #1565c0;
}
.dss-brain__md {
  margin: 0;
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 0.92rem;
  line-height: 1.55;
  color: #1e293b;
}
.dss-brain__embed {
  width: 100%;
  min-height: 420px;
  margin-top: 1rem;
  border: 0;
  border-radius: 8px;
  background: #f1f5f9;
}
.dss-brain__err,
.dss-brain__loading {
  margin: 0;
  color: #64748b;
}
.dss-hub {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.dss-hub__card {
  display: flex;
  flex-direction: column;
  padding: 1.2rem 1.25rem 1.15rem;
  border-radius: 14px;
  border: 1px solid #e3e8ef;
  background: #fff;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.08);
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
  min-height: 100%;
}
.dss-hub__card:hover {
  border-color: #90caf9;
  box-shadow: 0 6px 18px rgba(25, 118, 210, 0.14);
  transform: translateY(-1px);
}
.dss-hub__card--warn {
  border-color: #ffcc80;
  background: linear-gradient(180deg, #fff8e1 0%, #fff 55%);
}
.dss-hub__card--strong {
  border-color: #90caf9;
  background: linear-gradient(180deg, #e8f1fb 0%, #fff 55%);
}
.dss-hub__card--ok {
  border-color: #a5d6a7;
  background: linear-gradient(180deg, #f1f8f4 0%, #fff 55%);
}
.dss-hub__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
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
.dss-hub__ai-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: #eceff1;
  color: #455a64;
}
.dss-hub__ai-badge--strong {
  background: #0d47a1;
  color: #fff;
}
.dss-hub__ai-badge--steady {
  background: #1565c0;
  color: #fff;
}
.dss-hub__ai-badge--soft {
  background: #ef6c00;
  color: #fff;
}
.dss-hub__ai-badge--warn {
  background: #c62828;
  color: #fff;
}
.dss-hub__ai-badge--ok {
  background: #2e7d32;
  color: #fff;
}
.dss-hub__card h2 {
  margin: 0.55rem 0 0.3rem;
  font-size: 1.12rem;
  color: #0d47a1;
}
.dss-hub__blurb {
  margin: 0;
  color: #64748b;
  font-size: 0.8125rem;
  line-height: 1.45;
}
.dss-hub__ai {
  margin-top: 0.85rem;
  padding: 0.75rem 0.85rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #e8eef8;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1;
}
.dss-hub__ai strong {
  font-size: 0.875rem;
  color: #0f172a;
  line-height: 1.35;
}
.dss-hub__ai span {
  font-size: 0.8125rem;
  color: #475569;
  line-height: 1.5;
}
.dss-hub__cta {
  display: inline-block;
  margin-top: 0.85rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #1565c0;
}
.dss-hub__section {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  color: #0d47a1;
}
.insight .impact {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 0.35rem;
}
.insight .impact.high {
  color: #c62828;
}
.insight .impact.medium {
  color: #ef6c00;
}
.insight .impact.low {
  color: #2e7d32;
}
.insight__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.65rem;
}
.insight__foot small {
  color: #94a3b8;
  text-transform: capitalize;
}
.insight__action {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #1565c0;
  text-decoration: none;
}
.insight__action:hover {
  text-decoration: underline;
}
.insight h3 {
  margin: 0.25rem 0 0.4rem;
  font-size: 1.05rem;
  color: #0d47a1;
}
.insight p {
  margin: 0;
  color: #475569;
  line-height: 1.5;
  font-size: 0.9rem;
}
@media (max-width: 720px) {
  .dss-hub {
    grid-template-columns: 1fr;
  }
}
</style>
