<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { productApi, reviewApi, formatVnd, getDiscountPercent } from '@/api/services'
import type { Product, ProductReview } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import QuantityStepper from '@/components/QuantityStepper.vue'
import ProductCard from '@/components/ProductCard.vue'
import NewsletterBanner from '@/components/NewsletterBanner.vue'

const route = useRoute()
const router = useRouter()
const product = ref<Product | null>(null)
const related = ref<Product[]>([])
const qty = ref(1)
const activeTab = ref<'info' | 'questions' | 'reviews'>('reviews')
const auth = useAuthStore()
const cart = useCartStore()
const message = ref('')
const reviews = ref<ProductReview[]>([])
const reviewCount = ref(0)
const showReviewForm = ref(false)
const reviewForm = ref({ rating: 5, comment: '' })
const reviewError = ref('')
const reviewSaving = ref(false)

const discount = computed(() => (product.value ? getDiscountPercent(product.value) : 0))
const isNew = computed(() => (product.value ? product.value.soldCount < 40 : false))

const displayRating = computed(() => {
  if (reviews.value.length) {
    return reviews.value.reduce((s, r) => s + r.rating, 0) / reviews.value.length
  }
  return product.value?.rating ?? 5
})

const mockReviews = computed(() => {
  if (reviews.value.length) {
    return reviews.value.map((r) => ({
      user: r.userName,
      rating: r.rating,
      text: r.comment,
      date: new Date(r.createdAt).toLocaleDateString('vi-VN'),
    }))
  }
  if (!product.value) return []
  return [
    { user: 'Nguyễn A.', rating: 5, text: 'Sản phẩm đúng mô tả, giao nhanh.', date: '2 tuần trước' },
    { user: 'Trần B.', rating: 4, text: 'Chất lượng tốt trong tầm giá.', date: '1 tháng trước' },
  ]
})

function starDisplay(rating: number) {
  const full = Math.round(rating)
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}

onMounted(async () => {
  const id = route.params.id as string
  const [p, all] = await Promise.all([productApi.getById(id), productApi.list()])
  if (!p) return
  product.value = p
  related.value = all.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 4)

  const [list, summary] = await Promise.all([
    reviewApi.list(id),
    reviewApi.summary(id),
  ])
  reviews.value = list
  reviewCount.value = summary?.totalReviews ?? list.length
  if (summary && summary.averageRating > 0) {
    product.value = { ...product.value, rating: summary.averageRating, reviewCount: summary.totalReviews }
  }
})

async function submitReview() {
  if (auth.role !== 'customer') {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  if (!product.value || !reviewForm.value.comment.trim()) {
    reviewError.value = 'Vui lòng nhập nội dung đánh giá'
    return
  }
  reviewSaving.value = true
  reviewError.value = ''
  try {
    const created = await reviewApi.create(product.value.id, {
      rating: reviewForm.value.rating,
      comment: reviewForm.value.comment.trim(),
    })
    reviews.value = [created, ...reviews.value]
    reviewCount.value += 1
    showReviewForm.value = false
    reviewForm.value = { rating: 5, comment: '' }
  } catch (e) {
    reviewError.value = e instanceof Error ? e.message : 'Không gửi được đánh giá'
  } finally {
    reviewSaving.value = false
  }
}

async function addToCart() {
  if (auth.role !== 'customer') {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  try {
    await cart.add(product.value!.id, qty.value)
    message.value = 'Đã thêm vào giỏ hàng'
    cart.openDrawer()
  } catch (e) {
    message.value = e instanceof Error ? e.message : 'Lỗi'
  }
}

async function addRelated(id: string) {
  if (auth.role !== 'customer') {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  await cart.add(id)
  cart.openDrawer()
}
</script>

<template>
  <div v-if="product" class="elegant-page">
    <div class="container elegant-page__inner">
      <nav class="elegant-crumb" aria-label="Breadcrumb">
        <RouterLink to="/">Trang chủ</RouterLink>
        <span class="elegant-crumb__sep">›</span>
        <RouterLink :to="{ name: 'search', query: { category: product.category } }">
          {{ product.category }}
        </RouterLink>
        <span class="elegant-crumb__sep">›</span>
        <span>{{ product.name }}</span>
      </nav>

      <div class="elegant-product">
        <div class="elegant-product__gallery">
          <div class="elegant-product__main">
            <div class="elegant-product__badges">
              <span v-if="isNew" class="elegant-badge elegant-badge--dark">Mới</span>
              <span v-if="discount > 0" class="elegant-badge elegant-badge--green">-{{ discount }}%</span>
            </div>
            <img :src="product.imageUrl" :alt="product.name" />
          </div>
          <div class="elegant-product__thumbs">
            <button type="button" class="elegant-product__thumb elegant-product__thumb--active" aria-label="Ảnh 1">
              <img :src="product.imageUrl" :alt="product.name" />
            </button>
          </div>
        </div>

        <div class="elegant-product__info">
          <p class="elegant-product__stars" :aria-label="`${displayRating} sao`">
            {{ starDisplay(displayRating) }}
            <span class="elegant-product__review-count">({{ reviewCount || product.reviewCount || mockReviews.length }} đánh giá)</span>
          </p>
          <h1 class="elegant-product__title">{{ product.name }}</h1>
          <p class="elegant-product__desc">{{ product.description }}</p>

          <div class="elegant-product__price-row">
            <span class="elegant-product__price">{{ formatVnd(product.price) }}</span>
            <span
              v-if="product.originalPrice && product.originalPrice > product.price"
              class="elegant-product__price-old"
            >
              {{ formatVnd(product.originalPrice) }}
            </span>
          </div>

          <p class="elegant-product__stock" :class="{ 'elegant-product__stock--out': product.stock <= 0 }">
            {{ product.stock > 0 ? `Còn ${product.stock} sản phẩm` : 'Hết hàng' }}
          </p>

          <div v-if="(auth.role === 'customer' || auth.role === 'guest') && product.stock > 0" class="elegant-product__qty">
            <span class="elegant-product__qty-label">Số lượng</span>
            <QuantityStepper v-model="qty" variant="pill" :min="1" :max="Math.max(product.stock, 1)" />
          </div>

          <div class="elegant-product__actions">
            <button type="button" class="btn-elegant-wish btn-interactive" aria-label="Yêu thích">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              Yêu thích
            </button>
            <button
              type="button"
              class="btn-elegant-primary btn-interactive"
              :disabled="product.stock <= 0"
              @click="addToCart"
            >
              {{ product.stock > 0 ? 'Thêm vào giỏ' : 'Hết hàng' }}
            </button>
          </div>
          <p v-if="product.stock <= 0" class="elegant-alert elegant-alert--error">Sản phẩm tạm hết hàng</p>
          <p v-if="message" class="elegant-alert" :class="message.startsWith('Đã') ? 'elegant-alert--success' : 'elegant-alert--error'">{{ message }}</p>

          <div class="elegant-product__shop">
            <div class="elegant-product__shop-avatar">{{ (product.shopName ?? 'S')[0] }}</div>
            <div>
              <strong>{{ product.shopName ?? 'SEDSP Official' }}</strong>
              <p>{{ product.shopLocation ?? 'TP.HCM' }} · Phản hồi trong 1 giờ</p>
            </div>
          </div>
        </div>
      </div>

      <div class="elegant-tabs">
        <div class="elegant-tabs__nav" role="tablist">
          <button
            type="button"
            role="tab"
            class="elegant-tabs__btn"
            :class="{ 'elegant-tabs__btn--active': activeTab === 'info' }"
            @click="activeTab = 'info'"
          >
            Thông tin thêm
          </button>
          <button
            type="button"
            role="tab"
            class="elegant-tabs__btn"
            :class="{ 'elegant-tabs__btn--active': activeTab === 'questions' }"
            @click="activeTab = 'questions'"
          >
            Hỏi đáp
          </button>
          <button
            type="button"
            role="tab"
            class="elegant-tabs__btn"
            :class="{ 'elegant-tabs__btn--active': activeTab === 'reviews' }"
            @click="activeTab = 'reviews'"
          >
            Đánh giá
          </button>
        </div>

        <div v-if="activeTab === 'info'" class="elegant-tabs__panel">
          <p><strong>Danh mục:</strong> {{ product.category }}</p>
          <p><strong>Đã bán:</strong> {{ product.soldCount }}</p>
          <p>{{ product.description }}</p>
        </div>

        <div v-else-if="activeTab === 'questions'" class="elegant-tabs__panel">
          <p class="elegant-muted">Chưa có câu hỏi nào. Hãy là người đầu tiên đặt câu hỏi về sản phẩm này.</p>
        </div>

        <div v-else class="elegant-tabs__panel">
          <div class="elegant-reviews-head">
            <h2>Đánh giá khách hàng</h2>
            <button
              type="button"
              class="btn-elegant-outline btn-interactive"
              @click="showReviewForm = !showReviewForm"
            >
              Viết đánh giá
            </button>
          </div>

          <form v-if="showReviewForm" class="review-form card" @submit.prevent="submitReview">
            <label>
              Số sao
              <select v-model.number="reviewForm.rating" class="input">
                <option v-for="n in 5" :key="n" :value="n">{{ n }} sao</option>
              </select>
            </label>
            <label>
              Nội dung
              <textarea v-model="reviewForm.comment" class="input" rows="3" required />
            </label>
            <p v-if="reviewError" class="form-error">{{ reviewError }}</p>
            <button type="submit" class="btn btn-primary btn-sm" :disabled="reviewSaving">
              {{ reviewSaving ? 'Đang gửi...' : 'Gửi đánh giá' }}
            </button>
          </form>

          <p v-if="!mockReviews.length" class="elegant-muted">Chưa có đánh giá nào.</p>
          <article v-for="(r, i) in mockReviews" :key="i" class="elegant-review">
            <div class="elegant-review__avatar">{{ r.user[0] }}</div>
            <div>
              <div class="elegant-review__top">
                <strong>{{ r.user }}</strong>
                <span class="elegant-review__stars">{{ starDisplay(r.rating) }}</span>
                <span class="elegant-muted">{{ r.date }}</span>
              </div>
              <p class="elegant-review__text">{{ r.text }}</p>
            </div>
          </article>
        </div>
      </div>

      <section v-if="related.length" class="elegant-related">
        <h2 class="elegant-related__title">Có thể bạn thích</h2>
        <div class="mkt-grid mkt-grid--shop">
          <ProductCard
            v-for="p in related"
            :key="p.id"
            :product="p"
            :show-add="auth.role === 'guest' || auth.role === 'customer'"
            @add="addRelated"
          />
        </div>
      </section>
    </div>

    <NewsletterBanner />
  </div>
  <p v-else class="empty container">Không tìm thấy sản phẩm</p>
</template>
