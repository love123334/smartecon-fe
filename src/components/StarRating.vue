<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: number
    max?: number
    size?: 'sm' | 'md'
    readonly?: boolean
  }>(),
  {
    modelValue: 5,
    max: 5,
    size: 'md',
    readonly: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

function pick(n: number) {
  if (props.readonly) return
  emit('update:modelValue', n)
}
</script>

<template>
  <div
    class="star-rating"
    :class="[`star-rating--${size}`, { 'star-rating--readonly': readonly }]"
    role="group"
    :aria-label="`${modelValue} trên ${max} sao`"
  >
    <button
      v-for="n in max"
      :key="n"
      type="button"
      class="star-rating__btn"
      :class="{ 'star-rating__btn--on': n <= modelValue }"
      :disabled="readonly"
      :aria-label="`${n} sao`"
      :aria-pressed="n <= modelValue"
      @click="pick(n)"
    >
      ★
    </button>
  </div>
</template>

<style scoped>
.star-rating {
  display: inline-flex;
  gap: 0.15rem;
  align-items: center;
}

.star-rating__btn {
  appearance: none;
  border: none;
  background: transparent;
  padding: 0.1rem;
  margin: 0;
  cursor: pointer;
  color: #cbd5e1;
  font-size: 1.35rem;
  line-height: 1;
  transition: color 0.12s ease, transform 0.12s ease;
}

.star-rating--sm .star-rating__btn {
  font-size: 1.1rem;
}

.star-rating__btn--on {
  color: #f59e0b;
}

.star-rating__btn:hover:not(:disabled),
.star-rating__btn:focus-visible:not(:disabled) {
  transform: scale(1.12);
  color: #fbbf24;
}

.star-rating--readonly .star-rating__btn {
  cursor: default;
}
</style>
