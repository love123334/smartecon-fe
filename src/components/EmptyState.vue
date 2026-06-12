<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description?: string
}>()
</script>

<template>
  <div class="empty empty--dashed card card--flat">
    <div v-if="icon" class="empty__icon" aria-hidden="true">{{ icon }}</div>
    <p style="margin: 0; font-weight: 600; color: var(--slate-800)">{{ title }}</p>
    <p v-if="description" class="muted" style="margin: 0.35rem 0 0">{{ description }}</p>
    <div v-if="$slots.default" style="margin-top: 1rem">
      <slot />
    </div>
  </div>
</template>
