<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { adminApi } from '@/api/services'
import type { SystemMetric } from '@/types'

const metrics = ref<SystemMetric[]>([])

onMounted(async () => {
  metrics.value = await adminApi.systemMetrics()
})
</script>

<template>
  <div>
    <h1 class="page-title">Giám sát hệ thống</h1>
    <div class="grid grid-2">
      <div v-for="m in metrics" :key="m.name" class="card metric">
        <h3>{{ m.name }}</h3>
        <p class="value">{{ m.value }}</p>
        <span :class="['status', m.status]">{{ m.status }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.metric h3 {
  margin: 0 0 0.35rem;
  font-size: 0.95rem;
}
.value {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}
.status {
  font-size: 0.75rem;
  text-transform: uppercase;
  font-weight: 600;
}
.status.ok {
  color: var(--color-success);
}
.status.warn {
  color: var(--color-warn);
}
.status.error {
  color: var(--color-danger);
}
</style>
