<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { productApi } from '@/api/services'
import type { Product } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import HomeHero from '@/components/home/HomeHero.vue'
import HomeCategories from '@/components/home/HomeCategories.vue'
import HomeFeatures from '@/components/home/HomeFeatures.vue'
import ProductCard from '@/components/ProductCard.vue'
import NewsletterBanner from '@/components/NewsletterBanner.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'

const products = ref<Product[]>([])
const loading = ref(true)
const auth = useAuthStore()
const cart = useCartStore()
const router = useRouter()

const flashSale = computed(() =>
  products.value.filter((p) => p.isFlashSale).slice(0, 6),
)

const bestSellers = computed(() =>
  [...products.value].sort((a, b) => b.soldCount - a.soldCount).slice(0, 4),
)

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
    cart.openDrawer()
  } catch {
    /* */
  }
}
</script>

<template>
  <div class="home-page">
    <HomeHero />

    <HomeCategories />

    <section v-if="flashSale.length" class="home-flash" aria-labelledby="flash-title">
      <div class="container">
        <div class="home-section-head">
          <div>
            <p class="home-flash__badge">⚡ Flash Sale</p>
            <h2 id="flash-title" class="home-section-head__title">Deal sốc hôm nay</h2>
          </div>
          <RouterLink to="/search" class="home-section-head__link btn-interactive">
            Xem cửa hàng →
          </RouterLink>
        </div>
        <div class="home-flash__track">
          <div v-for="p in flashSale" :key="p.id" class="home-flash__card reveal-up">
            <ProductCard
              :product="p"
              :show-add="auth.role === 'customer'"
              @add="addToCart"
            />
          </div>
        </div>
      </div>
    </section>

    <section class="home-bestsellers" aria-labelledby="best-title">
      <div class="container">
        <div class="home-section-head">
          <div>
            <h2 id="best-title" class="home-section-head__title">Bán chạy nhất</h2>
            <p class="home-section-head__sub">Được nhiều người chọn mua tuần này</p>
          </div>
        </div>

        <LoadingSpinner v-if="loading" />
        <div v-else class="home-bestsellers__grid grid-stagger">
          <ProductCard
            v-for="p in bestSellers"
            :key="p.id"
            :product="p"
            :show-add="auth.role === 'customer'"
            @add="addToCart"
          />
        </div>

        <div class="home-bestsellers__cta">
          <RouterLink to="/search" class="btn-elegant-primary btn-interactive">
            Khám phá toàn bộ cửa hàng
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="home-promo reveal-up">
      <div class="container home-promo__inner">
        <div>
          <h2>Gợi ý từ AI — mua đúng món, đỡ phân vân</h2>
          <p>Đăng nhập để nhận gợi ý cá nhân hóa và chat với trợ lý SEDSP.</p>
        </div>
        <RouterLink :to="auth.isLoggedIn ? '/recommendations' : '/login'" class="home-promo__btn btn-interactive">
          {{ auth.isLoggedIn ? 'Xem gợi ý' : 'Đăng nhập ngay' }}
        </RouterLink>
      </div>
    </section>

    <HomeFeatures />

    <NewsletterBanner />
  </div>
</template>
