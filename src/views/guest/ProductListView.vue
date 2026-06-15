<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
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

const products = ref<Product[]>([])
const categories = ref<string[]>([])
const loading = ref(true)
const category = ref('')
const priceRange = ref('')
const sort = ref('popular')
const visibleCount = ref(12)

const auth = useAuthStore()
const cart = useCartStore()
const router = useRouter()

const filtered = computed(() => {
  let list = products.value.filter((p) => {
    if (category.value && p.category !== category.value) return false
    return matchesPriceRange(p.price, priceRange.value)
  })
  if (sort.value === 'price-asc') list = [...list].sort((a, b) => a.price - b.price)
  else if (sort.value === 'price-desc') list = [...list].sort((a, b) => b.price - a.price)
  else list = [...list].sort((a, b) => b.soldCount - a.soldCount)
  return list
})

const visibleProducts = computed(() => filtered.value.slice(0, visibleCount.value))

const sectionTitle = computed(() => category.value || 'Tất cả sản phẩm')

onMounted(async () => {
  const [list, cats] = await Promise.all([productApi.list(), productApi.categories()])
  products.value = list
  categories.value = cats
  loading.value = false
})

watch([category, priceRange], () => {
  visibleCount.value = 12
})

async function addToCart(id: string) {
  if (!auth.isLoggedIn) {
    router.push({ name: 'login', query: { redirect: '/' } })
    return
  }
  try {
    await cart.add(id)
  } catch {
    /* cart store */
  }
}

function showMore() {
  visibleCount.value += 12
}
</script>

<template>
  <div class="shop-page">
    <ShopHero
      title="Cửa hàng"
      subtitle="Khám phá công nghệ phù hợp — gợi ý thông minh từ DSS & AI."
      :breadcrumb="[
        { label: 'Trang chủ', to: '/' },
        { label: 'Cửa hàng' },
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
        <div class="shop-toolbar">
          <h2 class="shop-toolbar__title">{{ sectionTitle }}</h2>
          <div class="shop-toolbar__actions">
            <label class="shop-sort">
              <span class="sr-only">Sắp xếp</span>
              <select v-model="sort">
                <option value="popular">Bán chạy</option>
                <option value="price-asc">Giá thấp → cao</option>
                <option value="price-desc">Giá cao → thấp</option>
              </select>
            </label>
          </div>
        </div>

        <LoadingSpinner v-if="loading" />
        <EmptyState
          v-else-if="!filtered.length"
          icon="📭"
          title="Chưa có sản phẩm"
          description="Thử đổi bộ lọc hoặc quay lại sau."
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
