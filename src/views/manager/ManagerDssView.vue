<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { dssApi } from '@/api/services'
import type { DssInsight } from '@/types'
import HybridDataNotice from '@/components/HybridDataNotice.vue'
import PageHeader from '@/components/PageHeader.vue'
import AiShortcutBar from '@/components/AiShortcutBar.vue'

const insights = ref<DssInsight[]>([])

onMounted(async () => {
  insights.value = await dssApi.managerInsights()
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
        { to: '/manager/dss/what-if', label: 'What-if khuyến mãi', highlight: true },
        { to: '/chatbot', label: 'Trợ lý AI quản lý', highlight: true },
        { to: '/manager/dashboard', label: 'Dashboard KPI' },
        { to: '/manager/analytics', label: 'Phân tích' },
      ]"
    />
    <HybridDataNotice
      message="KPI đơn hàng từ dữ liệu gộp; what-if khuyến mãi & phân khúc đang dùng mock demo trên frontend."
    />

    <div class="dss-hub">
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
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.dss-hub__card:hover {
  border-color: #90caf9;
  box-shadow: 0 8px 24px rgba(25, 118, 210, 0.1);
  transform: translateY(-1px);
  text-decoration: none;
}

.dss-hub__tag {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
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
  line-height: 1.45;
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
  font-size: 1rem;
}

h3 {
  margin: 0 0 0.5rem;
}

@media (max-width: 720px) {
  .dss-hub {
    grid-template-columns: 1fr;
  }
}
</style>
