<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { orderApi, productApi, reviewApi, formatVnd, getDiscountPercent } from '@/api/services'
import type { Order, Product, ProductReview } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { isOutOfStockError, useNoticeStore } from '@/stores/notice'
import {
  REVIEW_WINDOW_DAYS,
  checkReviewEligibility,
  type ReviewEligibility,
} from '@/utils/reviewEligibility'
import { sellerDisplayName } from '@/utils/sellerTag'
import { canShopAsBuyer } from '@/utils/roleNav'
import QuantityStepper from '@/components/QuantityStepper.vue'
import ProductCard from '@/components/ProductCard.vue'
import SellerShopTag from '@/components/SellerShopTag.vue'
import NewsletterBanner from '@/components/NewsletterBanner.vue'
import StarRating from '@/components/StarRating.vue'
import { handleProductImageError, repairProductImageUrl } from '@/utils/productImage'

const route = useRoute()
const router = useRouter()
const product = ref<Product | null>(null)
const related = ref<Product[]>([])
const myOrders = ref<Order[]>([])
const qty = ref(1)
const activeImage = ref(0)
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

const gallery = computed(() => {
  if (!product.value) return []
  const urls = product.value.imageUrls?.length
    ? product.value.imageUrls
    : [product.value.imageUrl]
  return urls
    .filter(Boolean)
    .map((u) =>
      repairProductImageUrl(u, {
        seed: product.value!.id,
        category: product.value!.category,
      }),
    )
    .slice(0, 5)
})

const mainImage = computed(() => gallery.value[activeImage.value] ?? product.value?.imageUrl ?? '')

function onDetailImgError(e: Event) {
  handleProductImageError(e, gallery.value)
}

const discount = computed(() => (product.value ? getDiscountPercent(product.value) : 0))
const isNew = computed(() => (product.value ? product.value.soldCount < 40 : false))
const shopLabel = computed(() => (product.value ? sellerDisplayName(product.value) : ''))

const displayRating = computed(() => {
  if (reviews.value.length) {
    return reviews.value.reduce((s, r) => s + r.rating, 0) / reviews.value.length
  }
  return product.value?.rating ?? 5
})

const displayReviews = computed(() =>
  reviews.value.map((r) => ({
    id: r.id,
    user: r.userName,
    rating: r.rating,
    text: r.comment,
    date: new Date(r.createdAt).toLocaleDateString('vi-VN'),
  })),
)

const eligibility = computed<ReviewEligibility>(() => {
  if (!product.value) {
    return {
      canReview: false,
      reason: 'not_purchased',
      message: 'Đang tải thông tin sản phẩm…',
    }
  }
  return checkReviewEligibility({
    isLoggedIn: auth.isLoggedIn,
    isCustomer: canShopAsBuyer(auth.role),
    productId: product.value.id,
    orders: myOrders.value,
    existingReviews: reviews.value,
    currentUserId: auth.user?.backendId ?? auth.user?.id,
  })
})

function starDisplay(rating: number) {
  const full = Math.round(rating)
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}

async function loadOrdersForReview() {
  if (!canShopAsBuyer(auth.role) || !auth.user) {
    myOrders.value = []
    return
  }
  try {
    myOrders.value = await orderApi.listForCustomer(auth.user.id)
  } catch {
    myOrders.value = []
  }
}

onMounted(async () => {
  const id = route.params.id as string
  if (route.hash === '#reviews') activeTab.value = 'reviews'

  const [p, all] = await Promise.all([productApi.getById(id), productApi.list()])
  if (!p) return
  product.value = p
  activeImage.value = 0
  related.value = all
    .filter((x) => x.category === p.category && x.id !== p.id)
    .slice(0, 4)

  const [list, summary] = await Promise.all([
    reviewApi.list(id),
    reviewApi.summary(id),
  ])
  reviews.value = list
  reviewCount.value = summary?.totalReviews ?? list.length
  if (summary && summary.averageRating > 0) {
    product.value = {
      ...product.value,
      rating: summary.averageRating,
      reviewCount: summary.totalReviews,
    }
  }

  await loadOrdersForReview()
})

watch(
  () => auth.user?.id,
  () => {
    void loadOrdersForReview()
  },
)

function toggleReviewForm() {
  if (!eligibility.value.canReview) {
    if (eligibility.value.reason === 'login' || eligibility.value.reason === 'role') {
      router.push({ name: 'login', query: { redirect: route.fullPath } })
      return
    }
    reviewError.value = eligibility.value.message.replace(/\*\*/g, '')
    showReviewForm.value = false
    return
  }
  reviewError.value = ''
  showReviewForm.value = !showReviewForm.value
}

async function submitReview() {
  if (!eligibility.value.canReview) {
    reviewError.value = !eligibility.value.canReview
      ? eligibility.value.message.replace(/\*\*/g, '')
      : 'Không đủ điều kiện đánh giá'
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
    const msg = e instanceof Error ? e.message : 'Không gửi được đánh giá'
    if (/purchased|delivered|already reviewed/i.test(msg)) {
      reviewError.value =
        'Chỉ đánh giá được sản phẩm đã mua và đã giao (trong 30 ngày), mỗi SP một lần.'
    } else {
      reviewError.value = msg
    }
  } finally {
    reviewSaving.value = false
  }
}

async function addToCart() {
  if (!canShopAsBuyer(auth.role)) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  if (!product.value) return
  if (product.value.stock <= 0) {
    useNoticeStore().showOutOfStock(product.value.name)
    return
  }
  try {
    await cart.add(product.value.id, qty.value)
    message.value = 'Đã thêm vào giỏ hàng'
  } catch (e) {
    if (isOutOfStockError(e)) {
      message.value = ''
      return
    }
    message.value = e instanceof Error ? e.message : 'Lỗi'
  }
}

async function addRelated(id: string) {
  if (!canShopAsBuyer(auth.role)) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  try {
    await cart.add(id)
  } catch {
    /* hết hàng → CenterNotice */
  }
}
</script>


<template>
  <div v-if="product" class="elegant-page">
    <div class="elegant-page__inner">
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
              <span v-if="discount > 0" class="elegant-badge elegant-badge--sale">-{{ discount }}%</span>
            </div>
            <img :src="mainImage" :alt="product.name" @error="onDetailImgError" />
          </div>
          <div class="elegant-product__thumbs">
            <button
              v-for="(url, idx) in gallery"
              :key="`${url}-${idx}`"
              type="button"
              class="elegant-product__thumb"
              :class="{ 'elegant-product__thumb--active': idx === activeImage }"
              :aria-label="`Ảnh ${idx + 1}`"
              @click="activeImage = idx"
            >
              <img :src="url" :alt="`${product.name} ${idx + 1}`" @error="onDetailImgError" />
            </button>
          </div>
        </div>

        <div class="elegant-product__info">
          <p class="elegant-product__stars" :aria-label="`${displayRating} sao`">
            {{ starDisplay(displayRating) }}
            <span class="elegant-product__review-count">({{ reviewCount || product.reviewCount || displayReviews.length }} đánh giá)</span>
          </p>
          <h1 class="elegant-product__title">{{ product.name }}</h1>
          <p class="elegant-product__desc">
            {{ product.description?.split(/[.\n]/)[0]?.trim() || product.category }}
          </p>

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

          <div v-if="(canShopAsBuyer(auth.role) || auth.role === 'guest') && product.stock > 0" class="elegant-product__qty">
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
              @click="addToCart"
            >
              {{ product.stock > 0 ? 'Thêm vào giỏ' : 'Hết hàng' }}
            </button>
          </div>
          <p v-if="message" class="elegant-alert" :class="message.startsWith('Đã') ? 'elegant-alert--success' : 'elegant-alert--error'">{{ message }}</p>

          <div class="elegant-product__shop">
            <div class="elegant-product__shop-avatar">{{ shopLabel[0] ?? 'S' }}</div>
            <div class="elegant-product__shop-meta">
              <div class="elegant-product__shop-row">
                <strong>{{ shopLabel }}</strong>
                <SellerShopTag :product="product" size="md" />
              </div>
              <p>{{ product.shopLocation ?? 'Việt Nam' }} · Phản hồi trong 1 giờ</p>
              <p class="elegant-product__shop-note">
                Tag cửa hàng giúp phân biệt sản phẩm giữa nhiều người bán trên SEDSP.
              </p>
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

        <div v-else class="elegant-tabs__panel elegant-tabs__panel--reviews">
          <div class="elegant-reviews-head">
            <div>
              <h2>Đánh giá khách hàng</h2>
              <p v-if="displayReviews.length" class="elegant-reviews-head__meta">
                {{ displayRating.toFixed(1) }}★ · {{ reviewCount || displayReviews.length }} nhận xét
              </p>
            </div>
            <button
              type="button"
              class="btn-elegant-outline btn-interactive"
              :class="{ 'btn-elegant-outline--muted': !eligibility.canReview && eligibility.reason !== 'login' && eligibility.reason !== 'role' }"
              @click="toggleReviewForm"
            >
              {{ eligibility.canReview ? (showReviewForm ? 'Đóng form' : 'Viết đánh giá') : 'Viết đánh giá' }}
            </button>
          </div>

          <div v-if="displayReviews.length" class="elegant-reviews-summary" aria-hidden="true">
            <span class="elegant-reviews-summary__score">{{ displayRating.toFixed(1) }}</span>
            <div>
              <StarRating :model-value="Math.round(displayRating)" readonly size="sm" />
              <p>{{ reviewCount || displayReviews.length }} đánh giá</p>
            </div>
          </div>

          <div class="review-eligibility-note" role="note">
            <p>
              Chỉ khách hàng đã mua và nhận hàng mới được đánh giá.
              Thời hạn: <strong>{{ REVIEW_WINDOW_DAYS }} ngày</strong> kể từ khi đơn được giao.
            </p>
            <p v-if="!eligibility.canReview" class="review-eligibility-note__status">
              {{ eligibility.message.replace(/\*\*/g, '') }}
            </p>
            <p v-else class="review-eligibility-note__ok">
              Bạn đủ điều kiện đánh giá · còn {{ eligibility.daysLeft }} ngày.
            </p>
          </div>

          <form v-if="showReviewForm && eligibility.canReview" class="review-form card" @submit.prevent="submitReview">
            <div class="review-form__stars">
              <span>Số sao</span>
              <StarRating v-model="reviewForm.rating" />
            </div>
            <label>
              Nội dung
              <textarea v-model="reviewForm.comment" class="input" rows="3" required />
            </label>
            <p v-if="reviewError" class="form-error">{{ reviewError }}</p>
            <button type="submit" class="btn btn-primary btn-sm" :disabled="reviewSaving">
              {{ reviewSaving ? 'Đang gửi...' : 'Gửi đánh giá' }}
            </button>
          </form>
          <p v-else-if="reviewError" class="form-error">{{ reviewError }}</p>

          <div v-if="!displayReviews.length" class="elegant-reviews-empty">
            <p>Chưa có đánh giá cho sản phẩm này.</p>
            <p>Sau khi đơn được giao, bạn có thể chia sẻ trải nghiệm tại đây.</p>
          </div>
          <article v-for="r in displayReviews" :key="r.id" class="elegant-review">
            <div class="elegant-review__avatar">{{ r.user[0] }}</div>
            <div>
              <div class="elegant-review__top">
                <strong>{{ r.user }}</strong>
                <StarRating :model-value="r.rating" readonly size="sm" />
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
            :show-add="auth.role === 'guest' || canShopAsBuyer(auth.role)"
            @add="addRelated"
          />
        </div>
      </section>
    </div>

    <NewsletterBanner />
  </div>
  <p v-else class="empty container">Không tìm thấy sản phẩm</p>
</template>
