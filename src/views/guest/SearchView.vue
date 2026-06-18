<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { productApi } from '@/api/services'
import type { Product } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { matchesPriceRange } from '@/utils/priceFilter'
import ShopHero from '@/components/ShopHero.vue'
import ShopSidebar from '@/components/ShopSidebar.vue'
import ProductCard from '@/components/ProductCard.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import NewsletterBanner from '@/components/NewsletterBanner.vue'

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

const filtered = computed(() => {
  let list = results.value.filter((p) => matchesPriceRange(p.price, priceRange.value))
  if (sort.value === 'price-asc') list = [...list].sort((a, b) => a.price - b.price)
  else if (sort.value === 'price-desc') list = [...list].sort((a, b) => b.price - a.price)
  else list = [...list].sort((a, b) => b.soldCount - a.soldCount)
  return list
})

const visibleProducts = computed(() => filtered.value.slice(0, visibleCount.value))

const sectionTitle = computed(() => category.value || (q.value ? `Kết quả «${q.value}»` : 'Tất cả sản phẩm'))

async function search() {
  loading.value = true
  results.value = await productApi.list({
    q: q.value || undefined,
    category: category.value || undefined,
  })
  loading.value = false
  visibleCount.value = 12
  router.replace({
    query: {
      ...(q.value ? { q: q.value } : {}),
      ...(category.value ? { category: category.value } : {}),
    },
  })
}

watch(
  () => route.query,
  () => {
    q.value = (route.query.q as string) ?? ''
    category.value = (route.query.category as string) ?? ''
    search()
  },
  { immediate: true },
)

watch(category, () => search())

productApi.categories().then((c) => {
  categories.value = c
})

async function addToCart(id: string) {
  if (!auth.isLoggedIn) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  await cart.add(id)
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
        <form class="shop-search-inline" role="search" @submit.prevent="search">
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

        <LoadingSpinner v-if="loading" label="Đang tìm..." />
        <EmptyState
          v-else-if="!filtered.length"
          icon="🔎"
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
              :show-add="auth.role === 'customer'"
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
