<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { productApi } from '@/api/services'
import type { Product } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { matchesPriceRange } from '@/utils/priceFilter'
import { canShopAsBuyer } from '@/utils/roleNav'
import ShopHero from '@/components/ShopHero.vue'
import ShopSidebar from '@/components/ShopSidebar.vue'
import ProductCard from '@/components/ProductCard.vue'
import ProductSkeletonGrid from '@/components/ProductSkeletonGrid.vue'
import EmptyState from '@/components/EmptyState.vue'
import NewsletterBanner from '@/components/NewsletterBanner.vue'
import { addSearchHistory } from '@/utils/searchHistory'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const cart = useCartStore()

const q = ref((route.query.q as string) ?? '')
const category = ref((route.query.category as string) ?? '')
const priceRange = ref('')
const sort = ref('popular')
const categories = ref<string[]>([])
const results = ref<Product[]>([])
const loading = ref(false)
const visibleCount = ref(12)
/** Tránh vòng lặp route ↔ local state khi sync URL. */
let syncingFromRoute = false

const filtered = computed(() => {
  let list = results.value.filter((p) => matchesPriceRange(p.price, priceRange.value))
  if (sort.value === 'price-asc') list = [...list].sort((a, b) => a.price - b.price)
  else if (sort.value === 'price-desc') list = [...list].sort((a, b) => b.price - a.price)
  else list = [...list].sort((a, b) => b.soldCount - a.soldCount)
  return list
})

const visibleProducts = computed(() => filtered.value.slice(0, visibleCount.value))

const sectionTitle = computed(() => category.value || (q.value ? `Kết quả «${q.value}»` : 'Tất cả sản phẩm'))

function syncUrl() {
  const nextQuery: Record<string, string> = {
    ...(q.value ? { q: q.value } : {}),
    ...(category.value ? { category: category.value } : {}),
  }
  const curQ = typeof route.query.q === 'string' ? route.query.q : ''
  const curCat = typeof route.query.category === 'string' ? route.query.category : ''
  if (curQ === (nextQuery.q ?? '') && curCat === (nextQuery.category ?? '')) return
  router.replace({ query: nextQuery })
}

async function search(opts?: { recordHistory?: boolean }) {
  loading.value = true
  try {
    results.value = await productApi.list({
      q: q.value || undefined,
      category: category.value || undefined,
      size: 48,
    })
    if (opts?.recordHistory && q.value.trim()) {
      addSearchHistory(q.value.trim())
    }
  } finally {
    loading.value = false
    visibleCount.value = 12
    if (!syncingFromRoute) syncUrl()
  }
}

watch(
  () => route.query,
  async () => {
    syncingFromRoute = true
    q.value = (route.query.q as string) ?? ''
    category.value = (route.query.category as string) ?? ''
    await search()
    syncingFromRoute = false
  },
  { immediate: true },
)

watch(category, async (next, prev) => {
  if (syncingFromRoute || next === prev) return
  await search()
})

productApi.categories().then((c) => {
  categories.value = c
})

async function submitInlineSearch() {
  await search({ recordHistory: true })
}

async function addToCart(id: string) {
  if (!auth.isLoggedIn || !canShopAsBuyer(auth.role)) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  try {
    await cart.add(id)
  } catch {
    /* CenterNotice từ cart store */
  }
}

function showMore() {
  visibleCount.value += 12
}
</script>

<template>
  <div class="shop-page shop-page--catalog">
    <ShopHero
      variant="catalog"
      title="Cửa hàng"
      subtitle="Lọc, tìm kiếm và sắp xếp — trải nghiệm catalog đầy đủ."
      :breadcrumb="[
        { label: 'Trang chủ', to: '/' },
        { label: 'Cửa hàng', to: '/search' },
        ...(category ? [{ label: category }] : q ? [{ label: `«${q}»` }] : []),
      ]"
    />

    <div class="container shop-layout">
      <ShopSidebar
        :categories="categories"
        :category="category"
        :price-range="priceRange"
        @update:category="category = $event"
        @update:price-range="priceRange = $event"
      />

      <div class="shop-main">
        <form class="shop-search-inline" role="search" @submit.prevent="submitInlineSearch">
          <label for="shop-q" class="sr-only">Từ khóa</label>
          <input id="shop-q" v-model="q" type="search" placeholder="Tìm sản phẩm..." />
          <button type="submit" class="btn btn-primary btn-sm btn-interactive">Tìm</button>
        </form>

        <div class="shop-toolbar">
          <h2 class="shop-toolbar__title">{{ sectionTitle }}</h2>
          <label class="shop-sort">
            <span class="sr-only">Sắp xếp</span>
            <select v-model="sort">
              <option value="popular">Bán chạy</option>
              <option value="price-asc">Giá thấp → cao</option>
              <option value="price-desc">Giá cao → thấp</option>
            </select>
          </label>
        </div>

        <ProductSkeletonGrid v-if="loading" :count="8" />
        <EmptyState
          v-else-if="!filtered.length"
          title="Không có kết quả"
          :description="q ? `Không tìm thấy «${q}»` : 'Thử đổi bộ lọc khác'"
        />
        <template v-else>
          <p class="shop-result-count">{{ filtered.length }} sản phẩm</p>
          <div class="mkt-grid mkt-grid--shop grid-stagger">
            <ProductCard
              v-for="p in visibleProducts"
              :key="p.id"
              :product="p"
              :show-add="auth.role === 'guest' || canShopAsBuyer(auth.role)"
              @add="addToCart"
            />
          </div>
          <div v-if="visibleCount < filtered.length" class="shop-more-wrap">
            <button type="button" class="btn-show-more btn-interactive" @click="showMore">
              Xem thêm
            </button>
          </div>
        </template>
      </div>
    </div>

    <NewsletterBanner />
  </div>
</template>
