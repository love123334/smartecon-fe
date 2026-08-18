<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { productApi } from '@/api/services'
import type { Product } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { canShopAsBuyer } from '@/utils/roleNav'
import HomeHero from '@/components/home/HomeHero.vue'
import VoucherPromoBanner from '@/components/VoucherPromoBanner.vue'
import HomeCategories from '@/components/home/HomeCategories.vue'
import HomeFeatures from '@/components/home/HomeFeatures.vue'
import ProductCard from '@/components/ProductCard.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import NewsletterBanner from '@/components/NewsletterBanner.vue'
import { useChatWidgetStore } from '@/stores/chatWidget'

const products = ref<Product[]>([])
const loading = ref(true)
const catalogError = ref('')
const auth = useAuthStore()
const cart = useCartStore()
const router = useRouter()
const chatWidget = useChatWidgetStore()

const bestSellers = computed(() =>
  [...products.value].sort((a, b) => b.soldCount - a.soldCount).slice(0, 4),
)

function openChat() {
  chatWidget.show()
}

onMounted(async () => {
  catalogError.value = ''
  try {
    const meta = await productApi.listWithMeta({ size: 24 })
    if (meta.backendUnreachable) {
      catalogError.value =
        'Không kết nối được backend — một số sản phẩm có thể chưa hiển thị.'
    }
    products.value = meta.products
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
    <div v-if="catalogError" class="container">
      <p class="form-error" role="alert">{{ catalogError }}</p>
    </div>
    <div class="container">
      <VoucherPromoBanner />
    </div>

    <HomeCategories />

    <section class="home-bestsellers" aria-labelledby="best-title">
      <div class="container">
        <div class="home-section-head">
          <div>
            <h2 id="best-title" class="home-section-head__title">Bán chạy</h2>
            <p class="home-section-head__sub">Được chọn mua nhiều gần đây</p>
          </div>
        </div>

        <LoadingSpinner v-if="loading" page label="Đang tải sản phẩm" />
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
            class="btn-elegant-primary home-explore-btn btn-interactive"
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
