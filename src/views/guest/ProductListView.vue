<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { productApi } from '@/api/services'
import type { Product } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import PromoBanner from '@/components/PromoBanner.vue'
import ProductCard from '@/components/ProductCard.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'

const products = ref<Product[]>([])
const loading = ref(true)
const auth = useAuthStore()
const cart = useCartStore()
const router = useRouter()

const flashProducts = computed(() => products.value.filter((p) => p.isFlashSale))
const regularProducts = computed(() => products.value.filter((p) => !p.isFlashSale))

onMounted(async () => {
  products.value = await productApi.list()
  loading.value = false
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
</script>

<template>
  <div>
    <PromoBanner />

    <LoadingSpinner v-if="loading" />
    <template v-else-if="products.length">
      <section v-if="flashProducts.length" class="mkt-section">
        <div class="mkt-section__head">
          <h2 class="mkt-section__title mkt-section__title--flash">
            <span aria-hidden="true">⚡</span>
            Flash Sale
          </h2>
          <RouterLink to="/search" class="mkt-section__more">Xem tất cả →</RouterLink>
        </div>
        <div class="mkt-grid mkt-grid--flash grid-stagger">
          <ProductCard
            v-for="p in flashProducts"
            :key="p.id"
            :product="p"
            compact
            :show-add="auth.role === 'customer'"
            @add="addToCart"
          />
        </div>
      </section>

      <section class="mkt-section">
        <div class="mkt-section__head">
          <h2 class="mkt-section__title">Gợi ý hôm nay</h2>
          <RouterLink to="/search" class="mkt-section__more">Xem thêm →</RouterLink>
        </div>
        <div class="mkt-grid grid-stagger">
          <ProductCard
            v-for="p in regularProducts"
            :key="p.id"
            :product="p"
            :show-add="auth.role === 'customer'"
            @add="addToCart"
          />
        </div>
      </section>
    </template>
    <EmptyState
      v-else
      icon="📭"
      title="Chưa có sản phẩm"
      description="Seller có thể thêm sản phẩm từ trang quản lý."
    />
  </div>
</template>
