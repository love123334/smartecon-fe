<script setup lang="ts">
import HammerSickleLoader from '@/components/HammerSickleLoader.vue'

withDefaults(
  defineProps<{
    label?: string
    size?: 'sm' | 'md' | 'lg'
    /** Căn giữa vùng nội dung trang (product detail, catalog, …) */
    page?: boolean
  }>(),
  { label: 'Đang tải...', size: 'md', page: false },
)
</script>

<template>
  <div
    class="loading-spinner-wrap"
    :class="{ 'loading-spinner-wrap--page': page }"
    role="status"
    aria-live="polite"
  >
    <HammerSickleLoader :label="label" :size="size" class="loading-spinner" />
  </div>
</template>

<style scoped>
.loading-spinner-wrap {
  width: 100%;
}

.loading-spinner-wrap--page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: min(52vh, 480px);
  padding: 2.5rem 1rem;
}
</style>
