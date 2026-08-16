<script setup lang="ts">
import HammerSickleLoader from '@/components/HammerSickleLoader.vue'

withDefaults(
  defineProps<{
    label?: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { label: 'Đang tải...', size: 'md' },
)
</script>

<template>
  <HammerSickleLoader :label="label" :size="size" class="loading-spinner" />
</template>

<style scoped>
.loading-spinner {
  width: 100%;
}
</style>
