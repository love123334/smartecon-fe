<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  page: number
  totalPages: number
  totalElements?: number
}>()

const emit = defineEmits<{
  change: [page: number]
}>()

const pages = computed(() => {
  const total = Math.max(1, props.totalPages)
  const current = Math.min(Math.max(0, props.page), total - 1)
  const window = 5
  let start = Math.max(0, current - Math.floor(window / 2))
  let end = Math.min(total - 1, start + window - 1)
  start = Math.max(0, end - window + 1)
  const nums: number[] = []
  for (let i = start; i <= end; i += 1) nums.push(i)
  return nums
})

function go(page: number) {
  if (page < 0 || page >= props.totalPages || page === props.page) return
  emit('change', page)
}
</script>

<template>
  <nav v-if="totalPages > 1" class="shop-pagination" aria-label="Phân trang sản phẩm">
    <p v-if="totalElements != null" class="shop-pagination__meta">
      {{ totalElements }} sản phẩm · trang {{ page + 1 }}/{{ totalPages }}
    </p>
    <div class="shop-pagination__controls">
      <button
        type="button"
        class="shop-pagination__btn"
        :disabled="page <= 0"
        @click="go(page - 1)"
      >
        ← Trước
      </button>
      <button
        v-for="n in pages"
        :key="n"
        type="button"
        class="shop-pagination__btn"
        :class="{ 'shop-pagination__btn--active': n === page }"
        @click="go(n)"
      >
        {{ n + 1 }}
      </button>
      <button
        type="button"
        class="shop-pagination__btn"
        :disabled="page >= totalPages - 1"
        @click="go(page + 1)"
      >
        Sau →
      </button>
    </div>
  </nav>
</template>

<style scoped>
.shop-pagination {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.shop-pagination__meta {
  margin: 0;
  font-size: 0.875rem;
  color: var(--slate-600, #64748b);
}

.shop-pagination__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  justify-content: center;
}

.shop-pagination__btn {
  min-width: 2.25rem;
  padding: 0.45rem 0.75rem;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 999px;
  background: #fff;
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;
}

.shop-pagination__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.shop-pagination__btn--active {
  background: var(--primary-600, #2563eb);
  border-color: var(--primary-600, #2563eb);
  color: #fff;
}
</style>
