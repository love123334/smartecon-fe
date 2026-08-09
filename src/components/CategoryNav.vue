<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { iconForCategoryName, useCategoryStore } from '@/stores/categories'
import { roleCategoryAiLink } from '@/utils/roleAiNav'

const auth = useAuthStore()
const cats = useCategoryStore()
const route = useRoute()
const router = useRouter()
const scrollEl = ref<HTMLElement | null>(null)

const dragging = ref(false)
let pointerId: number | null = null
let startX = 0
let startScroll = 0
let moved = false
let capturing = false

const aiLink = computed(() => roleCategoryAiLink(auth.role, auth.isLoggedIn))
const activeCategory = computed(() =>
  typeof route.query.category === 'string' ? route.query.category : '',
)
const isHome = computed(() => route.path === '/' || route.name === 'home')

onMounted(() => {
  void cats.load()
})

function onPointerDown(e: PointerEvent) {
  const el = scrollEl.value
  if (!el || e.button !== 0) return
  dragging.value = false
  moved = false
  capturing = false
  pointerId = e.pointerId
  startX = e.clientX
  startScroll = el.scrollLeft
}

function onPointerMove(e: PointerEvent) {
  const el = scrollEl.value
  if (!el || pointerId !== e.pointerId) return
  const dx = e.clientX - startX
  if (!capturing && Math.abs(dx) > 6) {
    capturing = true
    moved = true
    dragging.value = true
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }
  if (!moved) return
  el.scrollLeft = startScroll - dx
}

function endDrag(e: PointerEvent) {
  const el = scrollEl.value
  if (!el || pointerId !== e.pointerId) return
  dragging.value = false
  if (capturing) {
    try {
      el.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }
  capturing = false
  pointerId = null
  queueMicrotask(() => {
    moved = false
  })
}

function goHome(e: MouseEvent) {
  if (moved) {
    e.preventDefault()
    return
  }
  router.push('/')
}

function goCategory(cat: string, e: MouseEvent) {
  if (moved) {
    e.preventDefault()
    return
  }
  router.push({ name: 'search', query: { category: cat } })
}

function goAi(e: MouseEvent) {
  if (moved) {
    e.preventDefault()
    return
  }
  router.push(aiLink.value.to)
}

onUnmounted(() => {
  pointerId = null
  dragging.value = false
  capturing = false
})
</script>

<template>
  <nav class="mkt-categories" aria-label="Danh mục sản phẩm">
    <div
      ref="scrollEl"
      class="container mkt-categories__scroll"
      :class="{ 'mkt-categories__scroll--dragging': dragging }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="endDrag"
      @pointercancel="endDrag"
    >
      <button
        type="button"
        class="mkt-cat-link mkt-cat-link--all"
        :class="{ 'mkt-cat-link--active': isHome }"
        @click="goHome"
      >
        Trang chủ
      </button>

      <span v-if="cats.loading && !cats.items.length" class="mkt-cat-link mkt-cat-link--muted" aria-live="polite">
        Đang tải danh mục…
      </span>
      <span v-else-if="cats.error && !cats.items.length" class="mkt-cat-link mkt-cat-link--muted">
        Không tải được danh mục
      </span>

      <button
        v-for="cat in cats.items"
        :key="cat.id"
        type="button"
        class="mkt-cat-link"
        :class="{ 'mkt-cat-link--active': activeCategory === cat.name }"
        @click="goCategory(cat.name, $event)"
      >
        <span aria-hidden="true">{{ iconForCategoryName(cat.name) }}</span>
        {{ cat.name }}
      </button>

      <button type="button" class="mkt-cat-link mkt-cat-link--ai" @click="goAi">
        <span aria-hidden="true">✨</span>
        {{ aiLink.label }}
      </button>
    </div>
  </nav>
</template>

<style scoped>
.mkt-cat-link--ai {
  color: var(--blue, #2e7df6);
  font-weight: 600;
}

.mkt-cat-link--muted {
  color: var(--navy-soft, #5b6c93);
  opacity: 0.85;
  pointer-events: none;
}

.mkt-categories__scroll {
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-x;
}

.mkt-categories__scroll--dragging {
  cursor: grabbing;
  scroll-behavior: auto;
}

.mkt-categories__scroll--dragging .mkt-cat-link {
  pointer-events: none;
}

.mkt-cat-link {
  appearance: none;
  background: none;
  border: none;
  cursor: pointer;
  font: inherit;
}
</style>
