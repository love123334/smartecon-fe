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
    <div class="spinner" aria-hidden="true" />
    <span>{{ label }}</span>
  </div>
</template>
