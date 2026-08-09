<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { productApi } from '@/api/services'
import type { ProductCatalogSort } from '@/api/real/products'
import type { Product } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useCategoryStore } from '@/stores/categories'
import { matchesPriceRange } from '@/utils/priceFilter'
import { canShopAsBuyer } from '@/utils/roleNav'
import ShopHero from '@/components/ShopHero.vue'
import ShopSidebar from '@/components/ShopSidebar.vue'
import ProductCard from '@/components/ProductCard.vue'
import ProductSkeletonGrid from '@/components/ProductSkeletonGrid.vue'
import ShopPagination from '@/components/ShopPagination.vue'
import EmptyState from '@/components/EmptyState.vue'
import NewsletterBanner from '@/components/NewsletterBanner.vue'
import { addSearchHistory } from '@/utils/searchHistory'

const PAGE_SIZE = 12

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const cart = useCartStore()
const cats = useCategoryStore()

const q = ref((route.query.q as string) ?? '')
const category = ref((route.query.category as string) ?? '')
const priceRange = ref('')
const sort = ref<ProductCatalogSort>(
  ((route.query.sort as string) || 'popular') as ProductCatalogSort,
)
const results = ref<Product[]>([])
const loading = ref(false)
const catalogError = ref('')
const page = ref(Number(route.query.page ?? 0) || 0)
const totalPages = ref(1)
const totalElements = ref(0)
let syncingFromRoute = false

const categories = computed(() => cats.names)

const filtered = computed(() =>
  results.value.filter((p) => matchesPriceRange(p.price, priceRange.value)),
)

const sectionTitle = computed(() => category.value || (q.value ? `Kết quả «${q.value}»` : 'Tất cả sản phẩm'))

function syncUrl() {
  const nextQuery: Record<string, string> = {
    ...(q.value ? { q: q.value } : {}),
    ...(category.value ? { category: category.value } : {}),
    ...(sort.value !== 'popular' ? { sort: sort.value } : {}),
    ...(page.value > 0 ? { page: String(page.value) } : {}),
  }
  const curQ = typeof route.query.q === 'string' ? route.query.q : ''
  const curCat = typeof route.query.category === 'string' ? route.query.category : ''
  const curSort = typeof route.query.sort === 'string' ? route.query.sort : 'popular'
  const curPage = Number(route.query.page ?? 0) || 0
  if (
    curQ === (nextQuery.q ?? '') &&
    curCat === (nextQuery.category ?? '') &&
    curSort === (nextQuery.sort ?? 'popular') &&
    curPage === page.value
  ) {
    return
  }
  router.replace({ query: nextQuery })
}

async function search(opts?: { recordHistory?: boolean }) {
  loading.value = true
  catalogError.value = ''
  try {
    const meta = await productApi.listWithMeta({
      q: q.value || undefined,
      category: category.value || undefined,
      size: PAGE_SIZE,
      page: page.value,
      sort: sort.value,
    })
    if (meta.backendUnreachable) {
      catalogError.value =
        'Không kết nối được backend — danh sách sản phẩm tạm trống. Thử reload sau vài phút.'
    }
    results.value = meta.products
    totalPages.value = Math.max(1, meta.totalPages ?? 1)
    totalElements.value = meta.totalElements ?? meta.products.length
    if (opts?.recordHistory && q.value.trim()) {
      addSearchHistory(q.value.trim())
    }
  } finally {
    loading.value = false
    if (!syncingFromRoute) syncUrl()
  }
}

watch(
  () => route.query,
  async () => {
    syncingFromRoute = true
    q.value = (route.query.q as string) ?? ''
    category.value = (route.query.category as string) ?? ''
    sort.value = ((route.query.sort as string) || 'popular') as ProductCatalogSort
    page.value = Number(route.query.page ?? 0) || 0
    await search()
    syncingFromRoute = false
  },
  { immediate: true },
)

watch(category, async (next, prev) => {
  if (syncingFromRoute || next === prev) return
  page.value = 0
  await search()
})

watch(sort, async (next, prev) => {
  if (syncingFromRoute || next === prev) return
  page.value = 0
  await search()
})

void cats.load()

async function submitInlineSearch() {
  page.value = 0
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

async function onPageChange(next: number) {
  page.value = next
  await search()
  window.scrollTo({ top: 0, behavior: 'smooth' })
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

        <p v-if="catalogError" class="form-error shop-catalog-error" role="alert">{{ catalogError }}</p>

        <div class="shop-toolbar">
          <h2 class="shop-toolbar__title">{{ sectionTitle }}</h2>
          <label class="shop-sort">
            <span class="sr-only">Sắp xếp</span>
            <select v-model="sort">
              <option value="popular">Bán chạy</option>
              <option value="newest">Mới nhất</option>
              <option value="rating-desc">Đánh giá cao → thấp</option>
              <option value="rating-asc">Đánh giá thấp → cao</option>
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
          <p class="shop-result-count">{{ totalElements || filtered.length }} sản phẩm</p>
          <div class="mkt-grid mkt-grid--shop grid-stagger">
            <ProductCard
              v-for="p in filtered"
              :key="p.id"
              :product="p"
              :show-add="auth.role === 'guest' || canShopAsBuyer(auth.role)"
              @add="addToCart"
            />
          </div>
          <ShopPagination
            :page="page"
            :total-pages="totalPages"
            :total-elements="totalElements"
            @change="onPageChange"
          />
        </template>
      </div>
    </div>

    <NewsletterBanner />
  </div>
</template>
