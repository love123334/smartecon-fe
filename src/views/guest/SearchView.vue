<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { productApi } from '@/api/services'
import type { Product } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import ProductCard from '@/components/ProductCard.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const cart = useCartStore()

const q = ref((route.query.q as string) ?? '')
const category = ref((route.query.category as string) ?? '')
const sort = ref('popular')
const categories = ref<string[]>([])
const results = ref<Product[]>([])
const loading = ref(false)

async function search() {
  loading.value = true
  let list = await productApi.list({
    q: q.value || undefined,
    category: category.value || undefined,
  })
  if (sort.value === 'price-asc') list = [...list].sort((a, b) => a.price - b.price)
  else if (sort.value === 'price-desc') list = [...list].sort((a, b) => b.price - a.price)
  else list = [...list].sort((a, b) => b.soldCount - a.soldCount)
  results.value = list
  loading.value = false
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

watch(sort, () => search())

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
</script>

<template>
  <div>
    <nav class="mkt-breadcrumb">
      <RouterLink to="/">Trang chủ</RouterLink>
      <span>/</span>
      <span>Tìm kiếm</span>
      <template v-if="category">
        <span>/</span>
        <span>{{ category }}</span>
      </template>
    </nav>

    <div class="mkt-section">
      <div class="toolbar" style="margin-bottom: 1rem; box-shadow: none; border: none; padding: 0">
        <div class="form-group" style="margin: 0; flex: 1; min-width: 180px">
          <label for="q" class="sr-only">Từ khóa</label>
          <input id="q" v-model="q" type="search" placeholder="Tên, mô tả sản phẩm..." @keyup.enter="search" />
        </div>
        <div class="form-group" style="margin: 0; min-width: 140px">
          <label for="cat" class="sr-only">Danh mục</label>
          <select id="cat" v-model="category" @change="search">
            <option value="">Tất cả danh mục</option>
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="form-group" style="margin: 0; min-width: 140px">
          <label for="sort" class="sr-only">Sắp xếp</label>
          <select id="sort" v-model="sort">
            <option value="popular">Bán chạy</option>
            <option value="price-asc">Giá thấp → cao</option>
            <option value="price-desc">Giá cao → thấp</option>
          </select>
        </div>
        <button type="button" class="btn btn-primary" @click="search">Tìm</button>
      </div>

      <p v-if="!loading && results.length" class="muted" style="margin: 0 0 1rem">
        {{ results.length }} sản phẩm
        <template v-if="q"> cho «{{ q }}»</template>
        <template v-if="category"> trong {{ category }}</template>
      </p>

      <LoadingSpinner v-if="loading" label="Đang tìm kiếm..." />
      <EmptyState
        v-else-if="!results.length"
        icon="🔎"
        title="Không có kết quả"
        :description="q ? `Không tìm thấy sản phẩm cho «${q}»` : 'Thử từ khóa hoặc danh mục khác'"
      />
      <div v-else class="mkt-grid grid-stagger">
        <ProductCard
          v-for="p in results"
          :key="p.id"
          :product="p"
          :show-add="auth.role === 'customer'"
          @add="addToCart"
        />
      </div>
    </div>
  </div>
</template>
