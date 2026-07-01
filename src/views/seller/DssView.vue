<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
      lead="Gợi ý tồn kho, giá và khuyến mãi dựa trên sản phẩm của bạn."
    />
    <AiShortcutBar
      title="Tiếp theo:"
      :links="[
        { to: '/seller/chatbot', label: 'Trợ lý AI người bán', highlight: true },
        { to: '/seller/sales', label: 'Bảng doanh số' },
        { to: '/seller/inventory', label: 'Tồn kho' },
      ]"
    />
    <HybridDataNotice
      message="Tồn kho lấy từ API; khuyến mãi & what-if vẫn mô phỏng DSS."
    />
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
</style>
