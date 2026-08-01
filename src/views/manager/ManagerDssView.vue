<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { dssApi } from '@/api/services'
import type { DssInsight } from '@/types'
import type { DssInsightPlanApi } from '@/api/real/dss'
import PageHeader from '@/components/PageHeader.vue'
import AiShortcutBar from '@/components/AiShortcutBar.vue'

const insights = ref<DssInsight[]>([])
const plan = ref<DssInsightPlanApi | null>(null)
const planError = ref('')
const planLoading = ref(false)
const embedUrl = computed(() => plan.value?.powerBiEmbedUrl?.trim() || '')
const planCommentary = computed(() => {
  const raw = plan.value?.commentary?.trim() || ''
  return raw
    .replace(/\n*-{2,}\s*\n*Metrics snapshot:[\s\S]*$/i, '')
    .replace(/\n*Metrics snapshot:[\s\S]*$/i, '')
    .trim()
})

onMounted(async () => {
  insights.value = await dssApi.managerInsights()
  planLoading.value = true
  planError.value = ''
  try {
    plan.value = await dssApi.insightPlan()
  } catch (e) {
    planError.value = e instanceof Error ? e.message : 'Không tải được kế hoạch DSS'
  } finally {
    planLoading.value = false
  }
})
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Quản lý"
      title="DSS Quản lý"
      lead="Gợi ý vận hành và mô phỏng what-if khuyến mãi cho toàn sàn."
    />
    <AiShortcutBar
      title="Tiếp theo:"
      :links="[
        { to: '/manager/platform-revenue', label: 'Doanh thu sàn', highlight: true },
        { to: '/manager/dss/what-if', label: 'What-if khuyến mãi', highlight: true },
        { to: '/manager/dashboard', label: 'Dashboard KPI' },
        { to: '/manager/analytics', label: 'Phân tích' },
      ]"
    />
    <section class="dss-brain">
      <div class="dss-brain__head">
        <h3>Nhận xét & kế hoạch</h3>
        <small v-if="plan">{{ plan.generatedAt }}</small>
      </div>
      <p v-if="planLoading">Đang tổng hợp số liệu…</p>
      <p v-else-if="planError" class="dss-brain__err">{{ planError }}</p>
      <div v-else-if="plan">
        <pre class="dss-brain__md">{{ planCommentary }}</pre>
        <iframe
          v-if="embedUrl"
          class="dss-brain__embed"
          :src="embedUrl"
          :title="plan.powerBiReportTitle || 'Power BI'"
          allowfullscreen
        />
      </div>
    </section>

    <div class="dss-hub">
      <RouterLink class="dss-hub__card" to="/manager/platform-revenue">
        <span class="dss-hub__tag">Revenue</span>
        <h2>Platform Revenue</h2>
        <p>GMV toàn sàn · xu hướng · top sellers/products · hoạt động nền tảng.</p>
        <span class="dss-hub__cta">Mở →</span>
      </RouterLink>
      <RouterLink class="dss-hub__card" to="/manager/dss/what-if">
        <span class="dss-hub__tag">What-if</span>
        <h2>So sánh kịch bản khuyến mãi</h2>
        <p>
          So sánh mức giảm giá · nhu cầu · lợi nhuận · rủi ro tồn kho · radar đa tiêu chí.
        </p>
        <span class="dss-hub__cta">Mở →</span>
      </RouterLink>
      <RouterLink class="dss-hub__card" to="/manager/analytics">
        <span class="dss-hub__tag">Phân tích</span>
        <h2>Phân tích danh mục</h2>
        <p>Theo dõi hiệu suất danh mục và xu hướng vận hành sàn.</p>
        <span class="dss-hub__cta">Mở →</span>
      </RouterLink>
    </div>

    <h3 class="dss-hub__section">Gợi ý nhanh</h3>
    <div class="grid grid-2">
      <article v-for="i in insights" :key="i.id" class="card">
        <h3>{{ i.title }}</h3>
        <p>{{ i.description }}</p>
        <span class="badge badge-confirmed">{{ i.category }}</span>
      </article>
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
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.dss-brain__head h3 {
  margin: 0;
  font-size: 1.05rem;
  color: #0d47a1;
}
.dss-brain__md {
  margin: 0;
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 0.92rem;
  line-height: 1.55;
}
.dss-brain__embed {
  width: 100%;
  min-height: 420px;
  margin-top: 1rem;
  border: 0;
  border-radius: 8px;
  background: #f1f5f9;
}
.dss-brain__err {
  color: #b91c1c;
}
.dss-hub {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.dss-hub__card {
  display: block;
  padding: 1.25rem 1.35rem;
  border-radius: 14px;
  background: #fff;
  border: 1px solid #e3e8ef;
  text-decoration: none;
  color: inherit;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.dss-hub__card:hover {
  border-color: #90caf9;
  text-decoration: none;
}
.dss-hub__tag {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #1565c0;
  background: #e3f2fd;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  margin-bottom: 0.65rem;
}
.dss-hub__card h2 {
  margin: 0 0 0.4rem;
  font-size: 1.1rem;
}
.dss-hub__card p {
  margin: 0;
  color: #64748b;
  font-size: 0.9rem;
}
.dss-hub__cta {
  display: inline-block;
  margin-top: 0.85rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: #1565c0;
}
.dss-hub__section {
  margin: 0 0 0.75rem;
}
@media (max-width: 720px) {
  .dss-hub {
    grid-template-columns: 1fr;
  }
}
</style>
