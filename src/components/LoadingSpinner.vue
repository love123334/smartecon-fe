<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
  }>(),
  { label: 'Đang tải...' },
)
</script>

<template>
  <div class="loading" role="status" aria-live="polite">
    <div class="spinner spinner--dual" aria-hidden="true" />
    <span>{{ label }}</span>
  </div>
</template>
