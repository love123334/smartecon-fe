<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { dssApi } from '@/api/services'
import type { DssInsight } from '@/types'

const insights = ref<DssInsight[]>([])

onMounted(async () => {
  insights.value = await dssApi.sellerInsights()
})
</script>

<template>
  <div>
    <h1 class="page-title">Hỗ trợ quyết định (DSS)</h1>
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
