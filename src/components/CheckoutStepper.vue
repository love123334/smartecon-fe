<script setup lang="ts">
defineProps<{
  step: 1 | 2 | 3
}>()

const steps = [
  { num: 1, label: 'Giỏ hàng', to: '/cart' },
  { num: 2, label: 'Thanh toán', to: '/checkout' },
  { num: 3, label: 'Hoàn tất', to: null },
] as const

function stepClass(current: number, step: number) {
  if (step < current) return 'checkout-step--done'
  if (step === current) return 'checkout-step--active'
  return ''
}
</script>

<template>
  <nav class="checkout-stepper" aria-label="Tiến trình đặt hàng">
    <div
      v-for="s in steps"
      :key="s.num"
      class="checkout-step"
      :class="stepClass(step, s.num)"
    >
      <div class="checkout-step__head">
        <span class="checkout-step__circle" aria-hidden="true">
          <svg v-if="step > s.num" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span v-else>{{ s.num }}</span>
        </span>
        <RouterLink v-if="s.to && step > s.num" :to="s.to" class="checkout-step__label">
          {{ s.label }}
        </RouterLink>
        <span v-else class="checkout-step__label">{{ s.label }}</span>
      </div>
      <div class="checkout-step__bar" />
    </div>
  </nav>
</template>
