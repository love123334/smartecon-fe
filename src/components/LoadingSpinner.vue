<script setup lang="ts">
import HammerSickleLoader from '@/components/HammerSickleLoader.vue'

withDefaults(
  defineProps<{
    label?: string
    sublabel?: string
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    /** Căn giữa toàn màn hình / trang */
    page?: boolean
    /** Lớp phủ mờ modal/frosted glass */
    overlay?: boolean
    variant?: 'quantum' | 'orbit' | 'minimal' | 'pulse'
    minHeight?: string
  }>(),
  {
    label: 'Đang tải dữ liệu...',
    sublabel: '',
    size: 'md',
    page: false,
    overlay: false,
    variant: 'quantum',
    minHeight: '',
  },
)
</script>

<template>
  <div
    class="loading-spinner-wrap"
    :class="{
      'loading-spinner-wrap--page': page,
      'loading-spinner-wrap--overlay': overlay,
    }"
    :style="minHeight ? { minHeight } : undefined"
    role="status"
    aria-live="polite"
  >
    <div v-if="overlay" class="loading-spinner-backdrop" />
    <div class="loading-spinner-card" :class="{ 'loading-spinner-card--elevated': overlay }">
      <HammerSickleLoader
        :label="label"
        :sublabel="sublabel"
        :size="size"
        :variant="variant"
        class="loading-spinner"
      />
    </div>
  </div>
</template>

<style scoped>
.loading-spinner-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem 0;
}

.loading-spinner-wrap--page {
  min-height: min(60vh, 520px);
  padding: 3rem 1rem;
}

.loading-spinner-wrap--overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1.5rem;
}

.loading-spinner-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.loading-spinner-card {
  position: relative;
  z-index: 1;
}

.loading-spinner-card--elevated {
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(226, 232, 240, 0.85);
  box-shadow: 0 12px 36px -4px rgba(15, 23, 42, 0.12), 0 4px 12px -2px rgba(15, 23, 42, 0.06);
  border-radius: 20px;
  padding: 1.5rem 2rem;
}
</style>
