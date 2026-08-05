<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { productApi } from '@/api/services'
import { useAuthStore } from '@/stores/auth'
import { roleCategoryAiLink } from '@/utils/roleAiNav'

const auth = useAuthStore()
const categories = ref<string[]>([])
const scrollEl = ref<HTMLElement | null>(null)

const dragging = ref(false)
let pointerId: number | null = null
let startX = 0
let startScroll = 0
let moved = false

const categoryIcons: Record<string, string> = {
  'Điện tử': '📱',
  'Điện thoại': '📱',
  Laptop: '💻',
  'Máy tính bảng': '📲',
  'Phụ kiện': '🎧',
  'Thời trang': '👕',
  'Thời trang nam': '👔',
  'Thời trang nữ': '👗',
  'Giày dép': '👟',
  'Làm đẹp': '💄',
  'Chăm sóc da': '✨',
  'Trang điểm': '💋',
  'Nhà cửa & đời sống': '🏡',
  'Nhà bếp': '🍳',
  'Nội thất': '🛋️',
  'Trang trí': '🖼️',
  'Gia dụng': '🏠',
  'Thể thao': '⚽',
  'Thiết bị thể hình': '🏋️',
  'Đồ dã ngoại': '🏕️',
  Sách: '📚',
}

const aiLink = computed(() => roleCategoryAiLink(auth.role, auth.isLoggedIn))
const aiTo = computed(() => aiLink.value.to)

onMounted(async () => {
  categories.value = await productApi.categories()
})

function onPointerDown(e: PointerEvent) {
  const el = scrollEl.value
  if (!el || e.button !== 0) return
  dragging.value = false
  moved = false
  pointerId = e.pointerId
  startX = e.clientX
  startScroll = el.scrollLeft
  el.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  const el = scrollEl.value
  if (!el || pointerId !== e.pointerId) return
  const dx = e.clientX - startX
  if (Math.abs(dx) > 4) {
    moved = true
    dragging.value = true
  }
  if (!moved) return
  el.scrollLeft = startScroll - dx
}

function endDrag(e: PointerEvent) {
  const el = scrollEl.value
  if (!el || pointerId !== e.pointerId) return
  dragging.value = false
  try {
    el.releasePointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
  pointerId = null
}

/** Prevent accidental navigation when user was dragging the rail */
function onLinkClick(e: MouseEvent) {
  if (moved) {
    e.preventDefault()
    e.stopPropagation()
    moved = false
  }
}

onUnmounted(() => {
  pointerId = null
  dragging.value = false
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
      <RouterLink
        to="/"
        class="mkt-cat-link mkt-cat-link--all"
        @click="onLinkClick"
      >
        Trang chủ
      </RouterLink>
      <RouterLink
        v-for="cat in categories"
        :key="cat"
        :to="{ name: 'search', query: { category: cat } }"
        class="mkt-cat-link"
        @click="onLinkClick"
      >
        <span aria-hidden="true">{{ categoryIcons[cat] ?? '🏷️' }}</span>
        {{ cat }}
      </RouterLink>
      <RouterLink :to="aiTo" class="mkt-cat-link mkt-cat-link--ai" @click="onLinkClick">
        <span aria-hidden="true">✨</span>
        {{ aiLink.label }}
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.mkt-cat-link--ai {
  color: var(--blue, #2e7df6);
  font-weight: 600;
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
</style>
