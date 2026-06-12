<script setup lang="ts">
defineProps<{
  title: string
  lead?: string
  eyebrow?: string
}>()
</script>

<template>
  <header class="page-header">
    <p v-if="eyebrow" class="page-header__eyebrow">{{ eyebrow }}</p>
    <h1 class="page-title">{{ title }}</h1>
    <p v-if="lead" class="page-lead">{{ lead }}</p>
    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>
