<script setup lang="ts">
const props = defineProps<{
  modelValue: number
  min?: number
  max?: number
  variant?: 'default' | 'pill'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

function clamp(n: number) {
  const lo = props.min ?? 1
  const hi = props.max ?? 999
  return Math.min(hi, Math.max(lo, n))
}

function decrement() {
  emit('update:modelValue', clamp(props.modelValue - 1))
}

function increment() {
  emit('update:modelValue', clamp(props.modelValue + 1))
}
</script>

<template>
  <div
    class="qty-stepper"
    :class="{ 'qty-stepper--pill': variant === 'pill' }"
    role="group"
    aria-label="Số lượng"
  >
    <button
      type="button"
      class="qty-stepper__btn"
      :disabled="modelValue <= (min ?? 1)"
      aria-label="Giảm số lượng"
      @click="decrement"
    >
      −
    </button>
    <span class="qty-stepper__value" aria-live="polite" aria-atomic="true">{{ modelValue }}</span>
    <button
      type="button"
      class="qty-stepper__btn"
      :disabled="max !== undefined && modelValue >= max"
      aria-label="Tăng số lượng"
      @click="increment"
    >
      +
    </button>
  </div>
</template>
