<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatVnd, productApi } from '@/api/services'
import type { Product } from '@/types'
import {
  addSearchHistory,
  buildSearchTrends,
  clearSearchHistory,
  getSearchHistory,
  removeSearchHistory,
} from '@/utils/searchHistory'

const route = useRoute()
const router = useRouter()

const open = ref(false)
const query = ref('')
const history = ref<string[]>([])
const categories = ref<string[]>([])
const suggestions = ref<Product[]>([])
const searching = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)
const rootEl = ref<HTMLElement | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const trends = computed(() => buildSearchTrends(categories.value))
const showProductCards = computed(() => query.value.trim().length >= 1)

onMounted(async () => {
  history.value = getSearchHistory()
  try {
    categories.value = await productApi.categories()
  } catch {
    /* keep defaults */
  }
})

watch(
  () => route.query.q,
  (q) => {
    if (typeof q === 'string') query.value = q
  },
)

watch(open, async (v) => {
  if (!v) return
  history.value = getSearchHistory()
  await nextTick()
  inputEl.value?.focus()
  inputEl.value?.select()
})

watch(query, (q) => {
  if (searchTimer) clearTimeout(searchTimer)
  const term = q.trim()
  if (!term) {
    suggestions.value = []
    searching.value = false
    return
  }
  searching.value = true
  searchTimer = setTimeout(async () => {
    try {
      const list = await productApi.list({ q: term, size: 8 })
      suggestions.value = list.slice(0, 6)
    } catch {
      suggestions.value = []
    } finally {
      searching.value = false
    }
  }, 220)
})

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function goSearch(raw: string) {
  const q = raw.trim()
  if (!q) {
    router.push({ name: 'search' })
    close()
    return
  }
  history.value = addSearchHistory(q)
  query.value = q
  router.push({ name: 'search', query: { q } })
  close()
}

function goProduct(p: Product) {
  history.value = addSearchHistory(p.name)
  router.push({ name: 'product-detail', params: { id: p.id } })
  close()
}

function submit() {
  goSearch(query.value)
}

function pickHistory(term: string) {
  goSearch(term)
}

function pickTrend(term: string) {
  goSearch(term)
}

function onRemoveHistory(term: string, e: Event) {
  e.stopPropagation()
  history.value = removeSearchHistory(term)
}

function onClearHistory() {
  clearSearchHistory()
  history.value = []
}

function onDocPointerDown(e: PointerEvent) {
  if (!open.value) return
  const el = rootEl.value
  if (el && e.target instanceof Node && !el.contains(e.target)) {
    close()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) close()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onKeydown)
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <div ref="rootEl" class="header-search">
    <button
      type="button"
      class="shop-icon-btn btn-interactive"
      title="Tìm kiếm"
      :aria-expanded="open"
      aria-controls="header-search-panel"
      aria-label="Tìm kiếm"
      @click="toggle"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
      </svg>
    </button>

    <Transition name="search-pop">
      <div
        v-if="open"
        id="header-search-panel"
        class="header-search__panel"
        role="dialog"
        aria-label="Tìm kiếm sản phẩm"
      >
      <form class="header-search__form" role="search" @submit.prevent="submit">
        <label class="sr-only" for="header-search-input">Từ khóa</label>
        <input
          id="header-search-input"
          ref="inputEl"
          v-model="query"
          type="search"
          placeholder="Tìm sản phẩm, thương hiệu..."
          autocomplete="off"
          enterkeyhint="search"
        />
        <button type="submit" class="header-search__submit btn-interactive" aria-label="Tìm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
          </svg>
        </button>
      </form>

      <div v-if="showProductCards" class="header-search__block">
        <div class="header-search__block-head">
          <span>Sản phẩm</span>
          <span v-if="searching" class="header-search__hint">Đang tìm…</span>
        </div>
        <ul v-if="suggestions.length" class="header-search__products">
          <li v-for="p in suggestions" :key="p.id">
            <button type="button" class="header-search__product" @click="goProduct(p)">
              <img :src="p.imageUrl" :alt="p.name" width="48" height="48" loading="lazy" />
              <span class="header-search__product-meta">
                <span class="header-search__product-name">{{ p.name }}</span>
                <span class="header-search__product-sub">
                  {{ formatVnd(p.price) }}
                  <template v-if="p.shopName"> · {{ p.shopName }}</template>
                </span>
              </span>
            </button>
          </li>
        </ul>
        <p v-else-if="!searching" class="header-search__empty">Không thấy sản phẩm khớp «{{ query.trim() }}»</p>
        <button
          v-if="query.trim()"
          type="button"
          class="header-search__see-all"
          @click="submit"
        >
          Xem tất cả kết quả →
        </button>
      </div>

      <template v-else>
        <div v-if="history.length" class="header-search__block">
          <div class="header-search__block-head">
            <span>Đã tìm gần đây</span>
            <button type="button" class="header-search__clear" @click="onClearHistory">Xóa</button>
          </div>
          <ul class="header-search__list">
            <li v-for="term in history" :key="`h-${term}`">
              <button type="button" class="header-search__chip" @click="pickHistory(term)">
                <span class="header-search__chip-ico" aria-hidden="true">🕐</span>
                <span class="header-search__chip-text">{{ term }}</span>
              </button>
              <button
                type="button"
                class="header-search__remove"
                :aria-label="`Xóa «${term}»`"
                @click="onRemoveHistory(term, $event)"
              >
                ×
              </button>
            </li>
          </ul>
        </div>

        <div class="header-search__block">
          <div class="header-search__block-head">
            <span>Xu hướng tìm kiếm</span>
          </div>
          <ul class="header-search__trends">
            <li v-for="(term, i) in trends" :key="`t-${term}`">
              <button type="button" class="header-search__trend" @click="pickTrend(term)">
                <span class="header-search__rank" :class="{ 'header-search__rank--hot': i < 3 }">{{ i + 1 }}</span>
                <span>{{ term }}</span>
              </button>
            </li>
          </ul>
        </div>
      </template>
    </div>
    </Transition>
  </div>
</template>

<style scoped>
.header-search {
  position: relative;
}

.header-search__panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 220;
  width: min(400px, calc(100vw - 1.5rem));
  max-height: min(70vh, 520px);
  overflow: auto;
  padding: 0.85rem;
  background: #fff;
  border: 1px solid var(--line, #e4e9f2);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.14);
}

.header-search__form {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
}

.header-search__form input {
  flex: 1;
  min-width: 0;
  height: 40px;
  padding: 0 0.85rem;
  border: 1px solid var(--line, #e4e9f2);
  border-radius: 9px;
  font: inherit;
  font-size: 0.875rem;
  outline: none;
  background: #f8fafc;
}

.header-search__form input:focus {
  border-color: var(--blue, #2e7df6);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(46, 125, 246, 0.12);
}

.header-search__submit {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 9px;
  background: var(--blue, #2e7df6);
  color: #fff;
  cursor: pointer;
}

.header-search__submit:hover {
  filter: brightness(1.05);
}

.header-search__block + .header-search__block {
  margin-top: 0.85rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--line, #eef2f7);
}

.header-search__block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.45rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--navy-soft, #5b6c93);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.header-search__hint {
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  color: var(--slate-400, #94a3b8);
}

.header-search__clear {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--blue, #2e7df6);
  cursor: pointer;
  text-transform: none;
  letter-spacing: 0;
}

.header-search__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.header-search__list > li {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.header-search__chip {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.5rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  font: inherit;
  font-size: 0.875rem;
  color: var(--navy, #14275c);
  text-align: left;
  cursor: pointer;
}

.header-search__chip:hover {
  background: var(--blue-soft, #eaf2ff);
}

.header-search__chip-ico {
  opacity: 0.55;
  font-size: 0.8rem;
}

.header-search__chip-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-search__remove {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--navy-soft, #5b6c93);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
}

.header-search__remove:hover {
  background: #f1f5f9;
  color: var(--navy, #14275c);
}

.header-search__trends {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.header-search__trend {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.4rem 0.45rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  font: inherit;
  font-size: 0.875rem;
  color: var(--navy, #14275c);
  text-align: left;
  cursor: pointer;
}

.header-search__trend:hover {
  background: var(--blue-soft, #eaf2ff);
}

.header-search__rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.15rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--navy-soft, #5b6c93);
}

.header-search__rank--hot {
  color: #e11d48;
}

.header-search__products {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.header-search__product {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.45rem;
  border: 1px solid var(--line, #eef2f7);
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.header-search__product:hover {
  border-color: #bfdbfe;
  background: #f8fbff;
}

.header-search__product img {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 8px;
  background: #f1f5f9;
  flex-shrink: 0;
}

.header-search__product-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.header-search__product-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--navy, #14275c);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-search__product-sub {
  font-size: 0.78rem;
  color: var(--slate-500, #64748b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-search__empty {
  margin: 0.35rem 0;
  font-size: 0.85rem;
  color: var(--slate-500, #64748b);
}

.header-search__see-all {
  margin-top: 0.55rem;
  width: 100%;
  border: none;
  background: transparent;
  padding: 0.45rem;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--blue, #2e7df6);
  cursor: pointer;
  text-align: center;
}

.header-search__see-all:hover {
  text-decoration: underline;
}
</style>
