<script setup lang="ts">
import type { NavLink } from '@/utils/roleAiNav'

defineProps<{
  links: NavLink[]
  title?: string
}>()
</script>

<template>
  <nav v-if="links.length" class="ai-shortcuts" aria-label="Liên kết AI liên quan">
    <span v-if="title" class="ai-shortcuts__title">{{ title }}</span>
    <RouterLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="ai-shortcuts__link"
      :class="{ 'ai-shortcuts__link--hi': link.highlight }"
    >
      {{ link.label }}
    </RouterLink>
  </nav>
</template>

<style scoped>
.ai-shortcuts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.65rem 0.85rem;
  background: var(--slate-50);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.ai-shortcuts__title {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--slate-500);
  margin-right: 0.25rem;
}

.ai-shortcuts__link {
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  background: #fff;
  border: 1px solid var(--color-border);
  color: var(--slate-700);
  text-decoration: none;
  transition: background var(--transition), border-color var(--transition);
}

.ai-shortcuts__link:hover {
  border-color: var(--primary-400);
  color: var(--primary-800);
  text-decoration: none;
}

.ai-shortcuts__link--hi {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #065f46;
}
</style>
