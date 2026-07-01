<script setup lang="ts">
defineProps<{
  /** real = dữ liệu API, hybrid = API + mô phỏng, mock = chỉ local */
  mode?: 'real' | 'hybrid' | 'mock'
  message?: string
}>()
</script>

<template>
  <p class="hybrid-notice" :data-mode="mode ?? 'hybrid'">
    <template v-if="message">{{ message }}</template>
    <template v-else-if="mode === 'real'">Dữ liệu từ backend API.</template>
    <template v-else-if="mode === 'mock'">Dữ liệu mô phỏng (chưa có API backend).</template>
    <template v-else>Dữ liệu kết hợp: API thật + mô phỏng KPI/DSS.</template>
  </p>
</template>

<style scoped>
.hybrid-notice {
  margin: 0 0 1rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  border-radius: var(--radius);
  background: var(--slate-50);
  border: 1px solid var(--color-border);
  color: var(--slate-600);
}
.hybrid-notice[data-mode='real'] {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #065f46;
}
</style>
