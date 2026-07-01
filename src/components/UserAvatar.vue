<script setup lang="ts">
import { computed } from 'vue'
import { getPresetById } from '@/utils/avatar'

const props = withDefaults(
  defineProps<{
    name?: string
    avatarPreset?: string
    avatarUrl?: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { size: 'md' },
)

const preset = computed(() => getPresetById(props.avatarPreset))
const initials = computed(() => {
  const n = props.name?.trim()
  if (!n) return '?'
  const parts = n.split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return n.slice(0, 2).toUpperCase()
})
</script>

<template>
  <span
    class="user-avatar"
    :class="`user-avatar--${size}`"
    :style="{ background: avatarUrl ? undefined : preset.bg }"
  >
    <img v-if="avatarUrl" :src="avatarUrl" :alt="name ?? 'Avatar'" class="user-avatar__img" />
    <span v-else-if="preset.emoji" class="user-avatar__emoji">{{ preset.emoji }}</span>
    <span v-else class="user-avatar__initials">{{ initials }}</span>
  </span>
</template>

<style scoped>
.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  overflow: hidden;
  flex-shrink: 0;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px var(--color-border);
}

.user-avatar--sm {
  width: 32px;
  height: 32px;
  font-size: 0.9rem;
}

.user-avatar--md {
  width: 40px;
  height: 40px;
  font-size: 1.1rem;
}

.user-avatar--lg {
  width: 72px;
  height: 72px;
  font-size: 2rem;
}

.user-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-avatar__emoji {
  line-height: 1;
}

.user-avatar__initials {
  font-size: 0.75em;
  font-weight: 700;
  color: var(--slate-700);
}
</style>
