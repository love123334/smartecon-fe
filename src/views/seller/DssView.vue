<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { dssApi } from '@/api/services'
import type { DssInsight } from '@/types'
import type { DssInsightPlanApi } from '@/api/real/dss'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'
import AiShortcutBar from '@/components/AiShortcutBar.vue'

const auth = useAuthStore()
const insights = ref<DssInsight[]>([])
const plan = ref<DssInsightPlanApi | null>(null)
const planError = ref('')
const planLoading = ref(false)

const sellerKey = computed(() => auth.user?.backendId ?? auth.user?.id)
const embedUrl = computed(() => plan.value?.powerBiEmbedUrl?.trim() || '')
const planCommentary = computed(() => {
  const raw = plan.value?.commentary?.trim() || ''
  return raw
    .replace(/\n*-{2,}\s*\n*Metrics snapshot:[\s\S]*$/i, '')
    .replace(/\n*Metrics snapshot:[\s\S]*$/i, '')
    .trim()
})

onMounted(async () => {
  insights.value = await dssApi.sellerInsights(sellerKey.value)
  planLoading.value = true
  planError.value = ''
  try {
    plan.value = await dssApi.insightPlan()
    // Fallback vẫn trả plan — nếu source local-fallback thì nhắc đăng nhập lại
    if (plan.value?.source === 'local-fallback') {
      planError.value = ''
    }
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
      eyebrow="Người bán"
      title="Hỗ trợ quyết định (DSS)"
      lead="Dự báo nhu cầu, gợi ý giá và khuyến nghị bổ sung tồn kho — dashboard phân tích cho người bán."
    />
    <AiShortcutBar
      title="Tiếp theo:"
      :links="[
        { to: '/seller/dss/demand', label: 'Dự báo nhu cầu', highlight: true },
        { to: '/seller/dss/price', label: 'Gợi ý giá', highlight: true },
        { to: '/seller/sales', label: 'Bảng doanh số', highlight: true },
        { to: '/seller/orders', label: 'Đơn bán' },
        { to: '/orders', label: 'Đơn mua' },
      ]"
    />
    <section class="dss-brain">
      <div class="dss-brain__head">
        <h3>Nhận xét & kế hoạch</h3>
        <small v-if="plan">{{ plan.generatedAt }}</small>
      </div>
      <p v-if="planLoading" class="dss-brain__loading">Đang tổng hợp số liệu…</p>
      <p v-else-if="planError" class="dss-brain__err">{{ planError }}</p>
      <div v-else-if="plan" class="dss-brain__body">
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
      <RouterLink class="dss-hub__card" to="/seller/dss/demand">
        <span class="dss-hub__tag">Dự báo</span>
        <h2>Dự báo nhu cầu</h2>
        <p>Moving Average · Historical Days / Forecast Period · thẻ KPI tóm tắt.</p>
        <span class="dss-hub__cta">Mở →</span>
      </RouterLink>
      <RouterLink class="dss-hub__card" to="/seller/dss/price">
        <span class="dss-hub__tag">Giá bán</span>
        <h2>Gợi ý giá</h2>
        <p>Hệ số co giãn · bảng scenario · best recommendation · không biểu đồ.</p>
        <span class="dss-hub__cta">Mở →</span>
      </RouterLink>
      <div class="dss-hub__card dss-hub__card--muted" aria-disabled="true" title="Dùng trang DSS riêng — không gắn trợ lý AI">
        <span class="dss-hub__tag">Tồn kho</span>
        <h2>Khuyến nghị tồn kho</h2>
        <p>Module vẫn có tại /seller/dss/inventory — không ưu tiên trong trợ lý AI.</p>
        <RouterLink class="dss-hub__cta" to="/seller/dss/inventory">Mở trang →</RouterLink>
      </div>
      <div class="dss-hub__card dss-hub__card--muted" aria-disabled="true" title="Dùng trang DSS riêng — không gắn trợ lý AI">
        <span class="dss-hub__tag">What-if</span>
        <h2>Giảm giá & lợi nhuận</h2>
        <p>Module vẫn có tại /seller/dss/what-if — không ưu tiên trong trợ lý AI.</p>
        <RouterLink class="dss-hub__cta" to="/seller/dss/what-if">Mở trang →</RouterLink>
      </div>
    </div>

    <h3 class="dss-hub__section">Gợi ý nhanh</h3>
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
.dss-hub__card--muted {
  opacity: 0.72;
  background: #f8fafc;
}
.dss-hub__card--muted:hover {
  border-color: #e3e8ef;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.08);
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
  font-size: 1.15rem;
  color: #0d47a1;
}
.dss-hub__card p {
  margin: 0;
  color: #64748b;
  font-size: 0.9rem;
}
.dss-hub__cta {
  display: inline-block;
  margin-top: 0.75rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: #1565c0;
}
.dss-hub__section {
  margin: 0 0 0.75rem;
}
.insight .impact {
  text-transform: uppercase;
  font-size: 0.7rem;
  font-weight: 700;
}
@media (max-width: 720px) {
  .dss-hub {
    grid-template-columns: 1fr;
  }
}
</style>
