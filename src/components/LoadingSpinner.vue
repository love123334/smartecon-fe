<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
  }>(),
  { label: 'Đang tải...' },
)
</script>

<template>
  <div class="loading loading--smooth" role="status" aria-live="polite">
    <div class="spinner spinner--dual" aria-hidden="true" />
    <span class="loading-soft">{{ label }}</span>
  </div>
</template>

<style scoped>
.loading--smooth {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1.5rem 1rem;
  color: var(--navy-soft, #5b6c93);
  font-size: 0.875rem;
  font-weight: 500;
}

.spinner--dual {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 2.5px solid rgba(46, 125, 246, 0.18);
  border-top-color: var(--blue, #2e7df6);
  border-right-color: var(--blue, #2e7df6);
  animation: spin-smooth 0.7s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
}

@keyframes spin-smooth {
  to {
    transform: rotate(360deg);
  }
}
</style>
