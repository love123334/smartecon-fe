<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatVnd, orderApi, productApi, reviewApi } from '@/api/services'
import type { Order, OrderStatus, Product, ProductReview } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { canShopAsBuyer } from '@/utils/roleNav'
import {
  REVIEW_WINDOW_DAYS,
  checkReviewEligibility,
  reviewAnchorDate,
} from '@/utils/reviewEligibility'
import CheckoutStepper from '@/components/CheckoutStepper.vue'
import NewsletterBanner from '@/components/NewsletterBanner.vue'
import OrderTrackStepper from '@/components/OrderTrackStepper.vue'
import SellerShopTag from '@/components/SellerShopTag.vue'
import OrderProductReview from '@/components/OrderProductReview.vue'
import { getOrderOverlay } from '@/utils/orderStatusOverlay'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const order = ref<Order | null>(null)
const productsById = ref<Record<string, Product>>({})
const reviewsByProductId = ref<Record<string, ProductReview[]>>({})
const cancelling = ref(false)

const statusNote = computed(() => {
  if (!order.value) return ''
  return getOrderOverlay(order.value.id)?.note ?? ''
})

const paymentLabel = computed(() => {
  const m = order.value?.paymentMethod
  if (m === 'vnpay' || m === 'bank') return 'VNPay'
  if (m === 'cod') return 'Thanh toán khi nhận hàng (COD)'
  if (m === 'momo_qr') return 'Chuyển MoMo tới shop'
  if (m === 'momo' || m === 'card') return 'Ví MoMo'
  return '—'
})

const isMomoQrPending = computed(
  () =>
    order.value?.paymentMethod === 'momo_qr' &&
    (order.value.status === 'pending' || order.value.rawStatus === 'PENDING'),
)

const isGatewayPaymentPending = computed(() => {
  if (!order.value || order.value.status !== 'pending') return false
  const m = order.value.paymentMethod
  return m === 'vnpay' || m === 'bank' || m === 'momo' || m === 'card'
})

const payError = ref('')
const verifyingPayment = ref(false)
const loading = ref(true)

async function verifyPaymentStatus() {
  if (!order.value) return false
  verifyingPayment.value = true
  payError.value = ''
  try {
    const payment = await orderApi.getPayment(order.value.id)
    if (payment?.status === 'SUCCESS') {
      order.value = (await orderApi.getById(order.value.id)) ?? order.value
      return true
    }
    if (payment?.status === 'FAILED') {
      payError.value = 'Thanh toán chưa thành công hoặc đã hết hạn.'
    }
    return false
  } catch (e) {
    payError.value = e instanceof Error ? e.message : 'Không kiểm tra được trạng thái thanh toán'
    return false
  } finally {
    verifyingPayment.value = false
  }
}

async function pollPaymentStatus(maxAttempts = 8) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const ok = await verifyPaymentStatus()
    if (ok) return
    await new Promise((r) => window.setTimeout(r, 2500))
  }
}

const statusLabel: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận / thanh toán',
  confirmed: 'Đã thanh toán / xác nhận',
  shipping: 'Đang giao hàng',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
}

const canCancel = computed(() => order.value?.status === 'pending')

const forceDetailView = ref(false)

/**
 * Chỉ hiện “Đặt hàng thành công” khi vừa checkout xong (?placed=1) và đơn còn pending.
 * Mọi lối vào từ lịch sử / đánh giá / đơn đã tiến triển → luôn trang chi tiết.
 */
const showCheckoutSuccess = computed(() => {
  if (!order.value) return false
  if (forceDetailView.value) return false
  if (String(route.query.placed ?? '') !== '1') return false
  // Chỉ pending mới được màn chúc mừng — confirmed/shipping/delivered luôn là chi tiết
  return order.value.status === 'pending'
})

function openOrderTracking() {
  forceDetailView.value = true
  if (route.query.placed === '1') {
    void router.replace({
      name: 'order-detail',
      params: { id: route.params.id },
      query: { view: 'detail' },
      hash: '#track',
    })
  }
  void nextTick(() => {
    document.getElementById('track-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function scrollToReviews() {
  forceDetailView.value = true
  void nextTick(() => {
    document.getElementById('items-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function preferDetailView() {
  forceDetailView.value = true
}

const reviewWindowNote = computed(() => {
  if (!order.value || order.value.status !== 'delivered') return ''
  const anchor = reviewAnchorDate(order.value)
  const until = new Date(anchor)
  until.setDate(until.getDate() + REVIEW_WINDOW_DAYS)
  return `Bạn có thể đánh giá sản phẩm đến hết ${until.toLocaleDateString('vi-VN')} (${REVIEW_WINDOW_DAYS} ngày sau khi giao).`
})

function itemReviewState(productId: string) {
  if (!order.value) {
    return { canReview: false, label: '—', message: '' }
  }
  const result = checkReviewEligibility({
    isLoggedIn: auth.isLoggedIn,
    isCustomer: canShopAsBuyer(auth.role),
    productId,
    orders: [order.value],
    existingReviews: reviewsByProductId.value[productId] ?? [],
    currentUserId: auth.user?.backendId ?? auth.user?.id,
  })
  if (result.canReview) {
    return {
      canReview: true,
      label: `Đánh giá (còn ${result.daysLeft} ngày)`,
      message: '',
    }
  }
  if (result.reason === 'expired') {
    return { canReview: false, label: 'Hết hạn đánh giá', message: result.message }
  }
  if (result.reason === 'already_reviewed') {
    return { canReview: false, label: 'Đã đánh giá', message: result.message }
  }
  if (result.reason === 'not_delivered') {
    return { canReview: false, label: 'Chờ giao xong', message: result.message }
  }
  return { canReview: false, label: 'Không đánh giá được', message: result.message }
}

async function loadOrderPage() {
  loading.value = true
  try {
  // Lối vào từ lịch sử / đánh giá → luôn chi tiết
  if (
    route.query.view === 'detail' ||
    route.query.review != null ||
    route.hash === '#reviews' ||
    route.hash === '#track' ||
    String(route.query.placed ?? '') !== '1'
  ) {
    preferDetailView()
  }

  order.value = await orderApi.getById(route.params.id as string)
  if (!order.value) return

  // Chỉ poll gateway (VNPay/MoMo ví) — MoMo QR là chuyển khoản thủ công, không poll
  if (isGatewayPaymentPending.value) {
    void pollPaymentStatus(6)
  }
  if (order.value.status !== 'pending') {
    preferDetailView()
    if (route.query.placed === '1') {
      void router.replace({
        name: 'order-detail',
        params: { id: String(order.value.id) },
        query: { view: 'detail' },
      })
    }
  }

  const map: Record<string, Product> = {}
  await Promise.all(
    order.value.items.map(async (item) => {
      const p = await productApi.getById(item.productId, { withStock: false }).catch(() => null)
      if (p) map[item.productId] = p
    }),
  )
  productsById.value = map

  if (canShopAsBuyer(auth.role) && order.value.status === 'delivered') {
    const entries = await Promise.all(
      order.value.items.map(async (item) => {
        const list = await reviewApi.list(item.productId).catch(() => [] as ProductReview[])
        return [item.productId, list] as const
      }),
    )
    reviewsByProductId.value = Object.fromEntries(entries)
  }

  if (route.query.review != null || route.hash === '#reviews') {
    scrollToReviews()
  } else if (route.hash === '#track') {
    openOrderTracking()
  }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadOrderPage()
})

// Cùng component /orders/:id khi đổi mã đơn hoặc query — phải reload
watch(
  () => [route.params.id, route.query.placed, route.query.view, route.query.review, route.hash] as const,
  () => {
    void loadOrderPage()
  },
)

async function cancelOrder() {
  if (!order.value || !canCancel.value) return
  if (!confirm('Bạn có chắc muốn hủy đơn hàng này?')) return
  cancelling.value = true
  try {
    order.value = await orderApi.updateStatus(order.value.id, 'cancelled')
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Không thể hủy đơn')
  } finally {
    cancelling.value = false
  }
}

async function onReviewSubmitted(productId: string) {
  if (!order.value) return
  const list = await reviewApi.list(productId).catch(() => [] as ProductReview[])
  reviewsByProductId.value = { ...reviewsByProductId.value, [productId]: list }
}
</script>

<template>
  <div v-if="loading" class="empty container">Đang tải đơn hàng…</div>
  <div v-else-if="order" class="elegant-page">
    <div class="elegant-page__inner">
      <template v-if="showCheckoutSuccess">
        <h1 class="elegant-page-title elegant-page-title--center">Đặt hàng thành công</h1>
        <CheckoutStepper :step="3" />

        <div class="elegant-complete">
          <div class="elegant-complete__card">
            <p class="elegant-complete__emoji">Đã đặt hàng</p>
            <h2 class="elegant-complete__heading">
              {{ order.paymentMethod === 'momo_qr' ? 'Hoàn tất chuyển MoMo' : 'Đơn đang chờ xác nhận' }}
            </h2>
            <p class="elegant-muted" style="margin: 0 0 1rem">
              <template v-if="order.paymentMethod === 'momo_qr'">
                MoMo sẽ tự điền thông tin chuyển khoản. Sau khi chuyển xong, đơn tự chuyển sang đã xác nhận.
              </template>
              <template v-else>
                Người bán / quản lý sẽ xác nhận đơn. Bạn có thể theo dõi tiến trình bên dưới hoặc trong lịch sử mua hàng.
              </template>
            </p>
            <p v-if="statusNote" class="elegant-muted" style="margin: 0 0 1rem">
              Cập nhật gần nhất: {{ statusNote }}
            </p>

            <OrderTrackStepper :status="order.status" show-hint />

            <div class="elegant-complete__thumbs">
              <div
                v-for="item in order.items"
                :key="item.productId"
                class="elegant-complete__thumb"
              >
                <img
                  :src="productsById[item.productId]?.imageUrl ?? 'https://placehold.co/80x80/f3f5f7/737373?text=SP'"
                  :alt="item.productName"
                />
                <span class="elegant-complete__qty">{{ item.quantity }}</span>
              </div>
            </div>

            <dl class="elegant-complete__meta">
              <div>
                <dt>Mã đơn</dt>
                <dd>#{{ order.id }}</dd>
              </div>
              <div>
                <dt>Ngày đặt</dt>
                <dd>{{ new Date(order.createdAt).toLocaleDateString('vi-VN') }}</dd>
              </div>
              <div>
                <dt>Tổng tiền</dt>
                <dd>{{ formatVnd(order.total) }}</dd>
              </div>
              <div>
                <dt>Thanh toán</dt>
                <dd>{{ paymentLabel }}</dd>
              </div>
            </dl>

            <button
              type="button"
              class="btn-elegant-primary btn-block btn-interactive"
              @click="openOrderTracking"
            >
              Theo dõi đơn hàng
            </button>
            <RouterLink to="/orders" class="btn-elegant-outline btn-block btn-interactive" style="margin-top: 0.75rem">
              Lịch sử mua hàng
            </RouterLink>
          </div>
        </div>
      </template>

      <template v-else>
        <nav class="elegant-crumb">
          <RouterLink to="/">Trang chủ</RouterLink>
          <span class="elegant-crumb__sep">›</span>
          <RouterLink to="/orders">Đơn hàng</RouterLink>
          <span class="elegant-crumb__sep">›</span>
          <span>#{{ order.id }}</span>
        </nav>

        <div class="order-detail">
          <header class="order-detail__head">
            <div>
              <p class="order-detail__eyebrow">Chi tiết đơn</p>
              <h1 class="order-detail__title">Đơn #{{ order.id }}</h1>
              <p class="order-detail__date">
                Đặt {{ new Date(order.createdAt).toLocaleString('vi-VN') }}
              </p>
            </div>
            <span class="elegant-status-badge" :data-status="order.status">
              {{ statusLabel[order.status] }}
            </span>
          </header>

          <section class="order-detail__track" aria-labelledby="track-heading">
            <h2 id="track-heading" class="order-detail__section-title">Tiến trình</h2>
            <OrderTrackStepper :status="order.status" show-hint />
            <p v-if="statusNote" class="order-detail__note">{{ statusNote }}</p>
          </section>

          <section class="order-detail__meta" aria-label="Thông tin giao nhận">
            <div>
              <span class="order-detail__meta-label">Giao tới</span>
              <p>{{ order.shippingAddress || '—' }}</p>
            </div>
            <div>
              <span class="order-detail__meta-label">Thanh toán</span>
              <p>{{ paymentLabel }}</p>
            </div>
          </section>

          <section
            v-if="isMomoQrPending && order.momoTransfer"
            class="order-detail__momo"
            aria-label="Thông tin chuyển MoMo"
          >
            <h2 class="order-detail__section-title">Chuyển MoMo tới shop</h2>
            <p class="order-detail__note">
              Chuyển <strong>{{ formatVnd(order.momoTransfer.amount) }}</strong>, nội dung
              <code>{{ order.momoTransfer.transferNote }}</code>
              <template v-if="order.momoTransfer.sellerStoreName">
                tới {{ order.momoTransfer.sellerStoreName }}.
              </template>
              MoMo tự điền thông tin — sau khi chuyển, đơn tự xác nhận.
            </p>
            <RouterLink
              :to="{ name: 'order-pay-momo', params: { id: order.id } }"
              class="btn-elegant-primary btn-interactive order-detail__momo-link"
            >
              Mở MoMo để chuyển
            </RouterLink>
          </section>

          <p v-if="payError" class="elegant-alert elegant-alert--error">{{ payError }}</p>
          <p v-if="verifyingPayment && isGatewayPaymentPending" class="order-detail__verify-hint">
            Đang kiểm tra trạng thái thanh toán…
          </p>

          <section class="order-detail__items" aria-labelledby="items-heading">
            <h2 id="items-heading" class="order-detail__section-title">Sản phẩm</h2>
            <article
              v-for="item in order.items"
              :key="item.productId"
              class="order-line"
            >
              <RouterLink
                class="order-line__media"
                :to="{ name: 'product-detail', params: { id: item.productId } }"
              >
                <img
                  :src="productsById[item.productId]?.imageUrl ?? 'https://placehold.co/80x80/f3f5f7/737373?text=SP'"
                  :alt="item.productName"
                />
              </RouterLink>
              <div class="order-line__body">
                <RouterLink
                  class="order-line__name"
                  :to="{ name: 'product-detail', params: { id: item.productId } }"
                >
                  {{ item.productName }}
                </RouterLink>
                <SellerShopTag
                  v-if="productsById[item.productId]"
                  :product="productsById[item.productId]"
                  size="sm"
                  class="order-line__shop"
                />
                <p class="order-line__qty">
                  × {{ item.quantity }} · {{ formatVnd(item.unitPrice) }}
                </p>
                <template v-if="order.status === 'delivered'">
                  <OrderProductReview
                    v-if="itemReviewState(item.productId).canReview"
                    :product-id="item.productId"
                    :product-name="item.productName"
                    @submitted="onReviewSubmitted(item.productId)"
                  />
                  <span
                    v-else
                    class="order-line__review-muted"
                    :title="itemReviewState(item.productId).message"
                  >
                    {{ itemReviewState(item.productId).label }}
                  </span>
                </template>
              </div>
              <strong class="order-line__subtotal">
                {{ formatVnd(item.unitPrice * item.quantity) }}
              </strong>
            </article>
          </section>

          <div class="order-detail__total">
            <span>Tổng cộng</span>
            <strong>{{ formatVnd(order.total) }}</strong>
          </div>

          <p v-if="order.status === 'delivered' && reviewWindowNote" class="order-detail__review-window">
            {{ reviewWindowNote }}
          </p>

          <div class="order-detail__footer">
            <button
              v-if="canCancel"
              type="button"
              class="btn-elegant-outline btn-interactive"
              :disabled="cancelling"
              @click="cancelOrder"
            >
              {{ cancelling ? 'Đang hủy...' : 'Hủy đơn hàng' }}
            </button>
            <RouterLink to="/orders" class="btn-elegant-outline btn-interactive">
              ← Quay lại đơn hàng
            </RouterLink>
          </div>
        </div>
      </template>
    </div>

    <NewsletterBanner />
  </div>
  <p v-else class="empty container">Không tìm thấy đơn hàng</p>
</template>

<style scoped>
.order-detail__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.75rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--line, #e4e9f2);
}

.order-detail__eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--slate-500, #5b6c93);
}

.order-detail__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.45rem, 2.8vw, 1.85rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--navy, #14275c);
}

.order-detail__date {
  margin: 0.35rem 0 0;
  font-size: 0.875rem;
  color: var(--slate-500, #5b6c93);
}

.order-detail__section-title {
  margin: 0 0 0.75rem;
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--navy, #14275c);
}

.order-detail__track {
  margin-bottom: 1.75rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--line, #e4e9f2);
}

.order-detail__note {
  margin: 0.65rem 0 0;
  font-size: 0.8125rem;
  color: var(--slate-500, #5b6c93);
}

.order-detail__meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.order-detail__meta-label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--slate-500, #5b6c93);
}

.order-detail__meta p {
  margin: 0;
  font-size: 0.95rem;
  color: var(--navy, #14275c);
  line-height: 1.45;
}

.order-detail__momo-link {
  display: inline-flex;
  margin-top: 0.75rem;
}

.order-detail__pay-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0 0 1.5rem;
}

.order-detail__items {
  margin-bottom: 1.25rem;
}

.order-line {
  display: grid;
  grid-template-columns: 72px 1fr auto;
  gap: 1rem;
  align-items: start;
  padding: 1.1rem 0;
  border-top: 1px solid var(--line, #e4e9f2);
}

.order-line:last-child {
  border-bottom: 1px solid var(--line, #e4e9f2);
}

.order-line__media {
  display: block;
  width: 72px;
  height: 72px;
  overflow: hidden;
  background: #f7f8fa;
}

.order-line__media img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.order-line__name {
  display: block;
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--navy, #14275c);
  text-decoration: none;
}

.order-line__name:hover {
  color: var(--primary-600, #2e7df6);
}

.order-line__shop {
  display: inline-flex;
  margin: 0.35rem 0 0.2rem;
}

.order-line__qty {
  margin: 0.2rem 0 0.45rem;
  font-size: 0.8125rem;
  color: var(--slate-500, #5b6c93);
}

.order-line__subtotal {
  font-size: 0.95rem;
  color: var(--navy, #14275c);
  white-space: nowrap;
}

.order-line__review-muted {
  font-size: 0.8125rem;
  color: var(--slate-400, #94a3b8);
}

.order-detail__total {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  gap: 1rem;
  margin: 0.5rem 0 1rem;
  padding-top: 0.75rem;
  font-family: var(--font-display);
}

.order-detail__total span {
  font-size: 0.875rem;
  color: var(--slate-500, #5b6c93);
}

.order-detail__total strong {
  font-size: 1.35rem;
  letter-spacing: -0.02em;
  color: var(--navy, #14275c);
}

.order-detail__review-window {
  margin: 0 0 1.25rem;
  font-size: 0.875rem;
  color: var(--slate-500, #5b6c93);
  text-align: right;
}

.order-detail__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 0.5rem;
}

@media (max-width: 560px) {
  .order-line {
    grid-template-columns: 64px 1fr;
  }

  .order-line__subtotal {
    grid-column: 2;
  }
}
</style>
