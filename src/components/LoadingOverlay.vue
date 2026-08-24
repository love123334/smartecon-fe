<script setup lang="ts">
import LoadingSpinner from '@/components/LoadingSpinner.vue'

withDefaults(
  defineProps<{
    show?: boolean
    label?: string
    sublabel?: string
    fixed?: boolean
  }>(),
  {
    show: true,
    label: 'Đang xử lý...',
    sublabel: 'Vui lòng đợi giây lát trong khi hệ thống hoàn tất yêu cầu.',
    fixed: false,
  },
)
</script>

<template>
  <Transition name="fade-overlay">
    <div
      v-if="show"
      class="loading-overlay"
      :class="{ 'loading-overlay--fixed': fixed }"
      role="alert"
      aria-busy="true"
    >
      <div class="loading-overlay__glass">
        <LoadingSpinner
          :label="label"
          :sublabel="sublabel"
          size="lg"
          variant="quantum"
        />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.28);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  padding: 1.5rem;
}

.loading-overlay--fixed {
  position: fixed;
}

.loading-overlay__glass {
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 20px 48px -8px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(226, 232, 240, 0.8);
  border-radius: 24px;
  padding: 2.25rem 2.5rem;
  max-width: 440px;
  width: 100%;
}

.fade-overlay-enter-active,
.fade-overlay-leave-active {
  transition: opacity 220ms ease, transform 220ms cubic-bezier(0.23, 1, 0.32, 1);
}

.fade-overlay-enter-from,
.fade-overlay-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
