<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { productApi, formatVnd, getDiscountPercent } from '@/api/services'
import type { Product } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import QuantityStepper from '@/components/QuantityStepper.vue'

const route = useRoute()
const router = useRouter()
const product = ref<Product | null>(null)
const qty = ref(1)
const auth = useAuthStore()
const cart = useCartStore()
const message = ref('')

const mockReviews = computed(() => {
  if (!product.value) return []
  return [
    { user: 'Nguyễn A.', rating: 5, text: 'Sản phẩm đúng mô tả, giao nhanh.' },
    { user: 'Trần B.', rating: 4, text: 'Chất lượng tốt trong tầm giá.' },
    { user: 'Lê C.', rating: 5, text: 'Shop tư vấn nhiệt tình, sẽ mua lại.' },
  ]
})

onMounted(async () => {
  const id = route.params.id as string
  product.value = await productApi.getById(id)
})

async function addToCart() {
  if (auth.role !== 'customer') {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  try {
    await cart.add(product.value!.id, qty.value)
    message.value = 'Đã thêm vào giỏ hàng'
  } catch (e) {
    message.value = e instanceof Error ? e.message : 'Lỗi'
  }
}

function buyNow() {
  if (auth.role !== 'customer') {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  addToCart().then(() => router.push('/checkout'))
}
</script>

<template>
  <div v-if="product">
    <nav class="mkt-breadcrumb" aria-label="Breadcrumb">
      <RouterLink to="/">Trang chủ</RouterLink>
      <span>/</span>
      <RouterLink :to="{ name: 'search', query: { category: product.category } }">
        {{ product.category }}
      </RouterLink>
      <span>/</span>
      <span>{{ product.name }}</span>
    </nav>

    <div class="mkt-detail">
      <div class="mkt-detail__grid">
        <div class="mkt-detail__gallery">
          <img :src="product.imageUrl" :alt="product.name" />
          <div class="mkt-detail__thumbs">
            <img
              :src="product.imageUrl"
              :alt="product.name"
              class="mkt-detail__thumb mkt-detail__thumb--active"
            />
          </div>
        </div>

        <div class="mkt-detail__info">
          <h1 class="page-title" style="font-size: 1.25rem; margin: 0">{{ product.name }}</h1>
          <p class="meta" style="margin: 0.5rem 0">
            <span class="rating-stars">★ {{ product.rating }}</span>
            {{ product.reviewCount ?? 0 }} đánh giá · Đã bán {{ product.soldCount }}
          </p>

          <div class="mkt-detail__price-block">
            <span class="mkt-detail__price">{{ formatVnd(product.price) }}</span>
            <span
              v-if="product.originalPrice && product.originalPrice > product.price"
              class="mkt-detail__price-original"
            >
              {{ formatVnd(product.originalPrice) }}
            </span>
            <span v-if="getDiscountPercent(product)" class="mkt-detail__discount-tag">
              -{{ getDiscountPercent(product) }}%
            </span>
          </div>

          <p style="font-size: 0.875rem; color: var(--slate-600)">{{ product.description }}</p>

          <p style="font-size: 0.875rem">
            <strong>Tình trạng:</strong>
            <span :style="{ color: product.stock > 0 ? 'var(--color-success)' : 'var(--color-danger)' }">
              {{ product.stock > 0 ? `Còn ${product.stock} sản phẩm` : 'Hết hàng' }}
            </span>
          </p>

          <div v-if="auth.role === 'customer' && product.stock > 0" style="margin: 1rem 0">
            <label style="font-size: 0.875rem; font-weight: 600; display: block; margin-bottom: 0.5rem">
              Số lượng
            </label>
            <QuantityStepper v-model="qty" :min="1" :max="product.stock" />
          </div>

          <div class="mkt-detail__shop">
            <div class="mkt-detail__shop-avatar">{{ (product.shopName ?? 'S')[0] }}</div>
            <div>
              <strong>{{ product.shopName ?? 'SEDSP Official' }}</strong>
              <p class="meta" style="margin: 0">{{ product.shopLocation ?? 'TP.HCM' }} · Phản hồi trong 1h</p>
            </div>
          </div>

          <div v-if="product.stock > 0" class="mkt-detail__actions">
            <button type="button" class="btn-cart" @click="addToCart">Thêm vào giỏ</button>
            <button type="button" class="btn-buy" @click="buyNow">Mua ngay</button>
          </div>
          <p v-else class="alert alert-error">Sản phẩm tạm hết hàng</p>
          <p v-if="message" class="alert alert-success">{{ message }}</p>
        </div>
      </div>

      <div class="mkt-detail__reviews">
        <h2 style="font-size: 1rem; margin: 0 0 1rem">Đánh giá sản phẩm</h2>
        <div v-for="(r, i) in mockReviews" :key="i" class="mkt-review-item">
          <strong>{{ r.user }}</strong>
          <span class="rating-stars" style="margin-left: 0.5rem">★ {{ r.rating }}</span>
          <p style="margin: 0.35rem 0 0; color: var(--slate-600)">{{ r.text }}</p>
        </div>
      </div>
    </div>
  </div>
  <p v-else class="empty">Không tìm thấy sản phẩm</p>
</template>
