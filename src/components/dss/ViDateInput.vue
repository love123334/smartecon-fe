<script setup lang="ts">
import { computed } from 'vue'
import { formatIsoDateVi } from '@/utils/demandPrediction'

const props = defineProps<{
  modelValue: string
  min?: string
  max?: string
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  id?: string
  describedBy?: string
  labelledBy?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const display = computed(() => formatIsoDateVi(props.modelValue) || 'dd/mm/yyyy')
const empty = computed(() => !formatIsoDateVi(props.modelValue))

function onInput(event: Event) {
  const el = event.target as HTMLInputElement
  emit('update:modelValue', el.value)
}
</script>

<template>
  <div class="vi-date" :class="{ 'vi-date--disabled': disabled }">
    <span class="vi-date__text" :class="{ 'vi-date__text--empty': empty }" aria-hidden="true">
      {{ display }}
    </span>
    <input
      :id="id"
      class="dss-input vi-date__native"
      type="date"
      lang="vi-VN"
      :value="modelValue"
      :min="min"
      :max="max"
      :disabled="disabled"
      :required="required"
      :aria-invalid="invalid ? 'true' : undefined"
      :aria-labelledby="labelledBy"
      :aria-describedby="describedBy"
      @input="onInput"
    />
  </div>
</template>

<style scoped>
.vi-date {
  position: relative;
  width: 100%;
}

.vi-date__text {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  pointer-events: none;
  font: inherit;
  font-weight: 500;
  color: #263238;
  letter-spacing: 0.01em;
}

.vi-date__text--empty {
  color: #90a4ae;
}

.vi-date--disabled .vi-date__text {
  color: #90a4ae;
}

.vi-date__native {
  width: 100%;
  color: transparent;
  caret-color: transparent;
}

.vi-date__native::-webkit-datetime-edit,
.vi-date__native::-webkit-datetime-edit-fields-wrapper,
.vi-date__native::-webkit-datetime-edit-text,
.vi-date__native::-webkit-datetime-edit-month-field,
.vi-date__native::-webkit-datetime-edit-day-field,
.vi-date__native::-webkit-datetime-edit-year-field {
  color: transparent;
}

.vi-date__native::-webkit-calendar-picker-indicator {
  position: relative;
  z-index: 2;
  cursor: pointer;
  opacity: 1;
}

.vi-date__native:disabled::-webkit-calendar-picker-indicator {
  cursor: not-allowed;
  opacity: 0.45;
}
</style>
