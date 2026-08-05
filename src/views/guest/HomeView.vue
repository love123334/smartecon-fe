<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { productApi } from '@/api/services'
import type { Product } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { canShopAsBuyer } from '@/utils/roleNav'
import HomeHero from '@/components/home/HomeHero.vue'
import HomeCategories from '@/components/home/HomeCategories.vue'
import HomeFeatures from '@/components/home/HomeFeatures.vue'
import ProductCard from '@/components/ProductCard.vue'
import ProductSkeletonGrid from '@/components/ProductSkeletonGrid.vue'
import NewsletterBanner from '@/components/NewsletterBanner.vue'
import { useChatWidgetStore } from '@/stores/chatWidget'

const products = ref<Product[]>([])
const loading = ref(true)
const auth = useAuthStore()
const cart = useCartStore()
const router = useRouter()
const chatWidget = useChatWidgetStore()

const flashSale = computed(() =>
  products.value.filter((p) => p.isFlashSale).slice(0, 6),
)

const bestSellers = computed(() =>
  [...products.value].sort((a, b) => b.soldCount - a.soldCount).slice(0, 4),
)

function openChat() {
  chatWidget.show()
}

onMounted(async () => {
  try {
    products.value = await productApi.list({ size: 24 })
  } finally {
    loading.value = false
  }
})

async function addToCart(id: string) {
  if (!auth.isLoggedIn || !canShopAsBuyer(auth.role)) {
    router.push({ name: 'login', query: { redirect: '/' } })
    return
  }
  try {
    await cart.add(id)
  } catch {
    /* CenterNotice từ cart store */
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
            <p class="home-flash__badge">Ưu đãi</p>
            <h2 id="flash-title" class="home-section-head__title">Giảm giá hôm nay</h2>
          </div>
          <RouterLink to="/search" class="home-section-head__link btn-interactive">
            Xem cửa hàng →
          </RouterLink>
        </div>
        <div class="home-flash__track">
          <div v-for="p in flashSale" :key="p.id" class="home-flash__card reveal-up">
            <ProductCard
              :product="p"
              :show-add="auth.role === 'guest' || canShopAsBuyer(auth.role)"
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
            <h2 id="best-title" class="home-section-head__title">Bán chạy</h2>
            <p class="home-section-head__sub">Được chọn mua nhiều gần đây</p>
          </div>
        </div>

        <ProductSkeletonGrid v-if="loading" :count="4" />
        <div v-else class="home-bestsellers__grid grid-stagger">
          <ProductCard
            v-for="p in bestSellers"
            :key="p.id"
            :product="p"
            :show-add="auth.role === 'guest' || canShopAsBuyer(auth.role)"
            @add="addToCart"
          />
        </div>

        <div class="home-bestsellers__cta">
          <button
            type="button"
            class="btn-elegant-primary home-explore-btn"
            @click="router.push({ name: 'search' })"
          >
            Khám phá toàn bộ cửa hàng
          </button>
        </div>
      </div>
    </section>

    <section class="home-promo">
      <div class="container home-promo__inner">
        <div>
          <p class="home-promo__eyebrow">Trợ lý SEDSP</p>
          <h2>Cần gợi ý nhanh?</h2>
          <p>Hỏi sản phẩm, so sánh giá hoặc kiểm tra đơn — mở chat góc phải màn hình.</p>
        </div>
        <button type="button" class="home-promo__btn" @click="openChat">
          Mở trợ lý
        </button>
      </div>
    </section>

    <HomeFeatures />

    <NewsletterBanner />
  </div>
</template>
