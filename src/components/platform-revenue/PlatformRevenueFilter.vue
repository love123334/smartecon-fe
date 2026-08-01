<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { PlatformRevenueDashboardQuery, RevenueGranularity } from '@/api/real/platformRevenue'
import {
  GRANULARITY_OPTIONS,
  TOP_LIMIT_OPTIONS,
  validatePlatformRevenueFilter,
} from '@/utils/platformRevenue'
import { todayIsoDate } from '@/utils/pricePrediction'

const props = defineProps<{
  modelValue: PlatformRevenueDashboardQuery
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: PlatformRevenueDashboardQuery]
  apply: [query: PlatformRevenueDashboardQuery]
}>()

const draft = reactive({
  fromDate: props.modelValue.fromDate,
  toDate: props.modelValue.toDate,
  granularity: props.modelValue.granularity,
  topLimit: props.modelValue.topLimit,
})

watch(
  () => props.modelValue,
  (v) => {
    draft.fromDate = v.fromDate
    draft.toDate = v.toDate
    draft.granularity = v.granularity
    draft.topLimit = v.topLimit
  },
  { deep: true },
)

const maxToDate = todayIsoDate()

const validation = computed(() =>
  validatePlatformRevenueFilter({
    fromDate: draft.fromDate,
    toDate: draft.toDate,
    granularity: draft.granularity,
    topLimit: draft.topLimit,
  }),
)

const canApply = computed(() => validation.value.ok && !props.loading)

function onApply() {
  if (!validation.value.ok) return
  emit('update:modelValue', validation.value.query)
  emit('apply', validation.value.query)
}

function setGranularity(g: RevenueGranularity) {
  draft.granularity = g
}
</script>

<template>
  <section class="card pr-filter" aria-labelledby="pr-filter-title">
    <h2 id="pr-filter-title" class="pr-section-title">Bộ lọc báo cáo</h2>
    <form class="pr-filter__grid" @submit.prevent="onApply">
      <label class="pr-field">
        <span>From Date</span>
        <input
          v-model="draft.fromDate"
          type="date"
          class="pr-input"
          :max="draft.toDate || maxToDate"
          :disabled="loading"
          required
        />
        <small
          v-if="!validation.ok && validation.errors.fromDate"
          class="pr-error"
          role="alert"
        >
          {{ validation.errors.fromDate }}
        </small>
      </label>

      <label class="pr-field">
        <span>To Date</span>
        <input
          v-model="draft.toDate"
          type="date"
          class="pr-input"
          :min="draft.fromDate || undefined"
          :max="maxToDate"
          :disabled="loading"
          required
        />
        <small
          v-if="!validation.ok && validation.errors.toDate"
          class="pr-error"
          role="alert"
        >
          {{ validation.errors.toDate }}
        </small>
      </label>

      <label class="pr-field">
        <span>Granularity</span>
        <select
          v-model="draft.granularity"
          class="pr-input"
          :disabled="loading"
          @change="setGranularity(draft.granularity)"
        >
          <option v-for="g in GRANULARITY_OPTIONS" :key="g" :value="g">{{ g }}</option>
        </select>
      </label>

      <label class="pr-field">
        <span>Top Limit</span>
        <select v-model.number="draft.topLimit" class="pr-input" :disabled="loading">
          <option v-for="n in TOP_LIMIT_OPTIONS" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>

      <div class="pr-filter__actions">
        <button type="submit" class="btn btn-primary" :disabled="!canApply" :aria-busy="loading">
          {{ loading ? 'Đang tải…' : 'Áp dụng' }}
        </button>
      </div>
    </form>
    <p
      v-if="!validation.ok && validation.errors.range"
      class="pr-error"
      role="alert"
      style="margin-top: 0.65rem"
    >
      {{ validation.errors.range }}
    </p>
  </section>
</template>

<style scoped>
.pr-section-title {
  margin: 0 0 0.85rem;
  font-size: 1rem;
}
.pr-filter__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
  gap: 0.75rem 1rem;
  align-items: end;
}
.pr-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--slate-600, #475569);
}
.pr-input {
  font: inherit;
  font-weight: 500;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--slate-200, #e2e8f0);
  border-radius: 8px;
  background: #fff;
  color: var(--slate-900, #0f172a);
}
.pr-input:focus-visible {
  outline: 2px solid #0d9488;
  outline-offset: 2px;
}
.pr-error {
  color: #b91c1c;
  font-size: 0.75rem;
  font-weight: 600;
}
.pr-filter__actions {
  display: flex;
  align-items: end;
}
@media (max-width: 900px) {
  .pr-filter__grid {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 560px) {
  .pr-filter__grid {
    grid-template-columns: 1fr;
  }
}
</style>
