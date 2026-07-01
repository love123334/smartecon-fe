<script setup lang="ts">
import { onMounted, ref } from 'vue'
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
      lead="Gợi ý vận hành và mô phỏng what-if cho toàn sàn."
    />
    <AiShortcutBar
      title="Tiếp theo:"
      :links="[
        { to: '/chatbot', label: 'Trợ lý AI quản lý', highlight: true },
        { to: '/manager/dashboard', label: 'Dashboard KPI' },
        { to: '/manager/analytics', label: 'Phân tích' },
      ]"
    />
    <HybridDataNotice
      message="KPI đơn hàng từ dữ liệu gộp; what-if & phân khúc vẫn mô phỏng."
    />
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
h3 {
  margin: 0 0 0.5rem;
}
</style>
