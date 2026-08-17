<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number | string
    title?: string
  }>(),
  {
    size: 24,
    title: 'Trợ lý AI',
  },
)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    :aria-label="title"
  >
    <rect x="2" y="3" width="20" height="14" rx="4" fill="currentColor" opacity="0.14" />
    <path
      d="M7 10.5h.01M12 10.5h.01M17 10.5h.01"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
    <path
      d="M8 21l4-3 4 3"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <circle cx="18.5" cy="5.5" r="2.25" fill="currentColor" opacity="0.85" />
    <path
      d="M17.8 4.9l.7.7M19.2 4.9l-.7.7"
      stroke="#fff"
      stroke-width="0.9"
      stroke-linecap="round"
    />
  </svg>
</template>
