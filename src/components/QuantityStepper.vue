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

function onInput(e: Event) {
  const raw = Number((e.target as HTMLInputElement).value)
  emit('update:modelValue', clamp(Number.isFinite(raw) ? raw : 1))
}
</script>

<template>
  <div class="qty-stepper" :class="{ 'qty-stepper--pill': variant === 'pill' }">
    <button type="button" :disabled="modelValue <= (min ?? 1)" aria-label="Giảm" @click="decrement">−</button>
    <input
      type="number"
      :value="modelValue"
      :min="min ?? 1"
      :max="max"
      @change="onInput"
    />
    <button type="button" :disabled="max !== undefined && modelValue >= max" aria-label="Tăng" @click="increment">+</button>
  </div>
</template>
