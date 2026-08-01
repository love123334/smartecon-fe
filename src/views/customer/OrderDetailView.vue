<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
  if (m === 'momo' || m === 'card') return 'Ví MoMo (legacy)'
  return '—'
})

const paying = ref(false)
const payError = ref('')

async function payAgain() {
  if (!order.value) return
  paying.value = true
  payError.value = ''
  try {
    try {
      sessionStorage.setItem('sedsp_pending_vnpay_order', String(order.value.id))
    } catch {
      /* ignore */
    }
    const pay = await orderApi.initiatePayment(order.value.id, 'vnpay')
    if (pay.redirectUrl?.startsWith('http')) {
      window.location.href = pay.redirectUrl
      return
    }
    if (pay.redirectUrl) {
      await router.push(pay.redirectUrl)
    }
  } catch (e) {
    payError.value = e instanceof Error ? e.message : 'Không thể thanh toán'
  } finally {
    paying.value = false
  }
}

const statusLabel: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao hàng',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
}

const canCancel = computed(() => order.value?.status === 'pending')

const isFreshOrder = computed(() => {
  if (!order.value) return false
  const age = Date.now() - new Date(order.value.createdAt).getTime()
  return age < 1000 * 60 * 30
})

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

onMounted(async () => {
  order.value = await orderApi.getById(route.params.id as string)
  if (!order.value) return

  const products = await productApi.list()
  const map: Record<string, Product> = {}
  for (const p of products) map[p.id] = p
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
})

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
  <div v-if="order" class="elegant-page">
    <div class="container elegant-page__inner">
      <template v-if="isFreshOrder && order.status !== 'cancelled'">
        <h1 class="elegant-page-title">Đặt hàng thành công</h1>
        <CheckoutStepper :step="3" />

        <div class="elegant-complete">
          <div class="elegant-complete__card">
            <p class="elegant-complete__emoji">Đã đặt hàng</p>
            <h2 class="elegant-complete__heading">Đơn đang chờ xác nhận</h2>
            <p class="elegant-muted" style="margin: 0 0 1rem">
              Người bán / quản lý sẽ xác nhận đơn. Bạn có thể theo dõi tiến trình bên dưới hoặc trong lịch sử mua hàng.
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

            <RouterLink :to="`/orders/${order.id}`" class="btn-elegant-primary btn-block btn-interactive">
              Theo dõi đơn hàng
            </RouterLink>
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
          <span>{{ order.id }}</span>
        </nav>

        <div class="elegant-order-detail">
          <div class="elegant-order-detail__head">
            <div>
              <h1 class="elegant-page-title" style="margin-bottom: 0.35rem">Đơn hàng #{{ order.id }}</h1>
              <p class="elegant-muted">
                Đặt ngày {{ new Date(order.createdAt).toLocaleString('vi-VN') }}
              </p>
            </div>
            <span class="elegant-status-badge" :data-status="order.status">
              {{ statusLabel[order.status] }}
            </span>
          </div>

          <section class="order-track-panel" aria-labelledby="track-heading">
            <h2 id="track-heading" class="order-track-panel__title">Theo dõi đơn hàng</h2>
            <OrderTrackStepper :status="order.status" show-hint />
            <p v-if="statusNote" class="elegant-muted" style="margin-top: 0.5rem">
              Ghi chú: {{ statusNote }}
            </p>
          </section>

          <p><strong>Địa chỉ giao:</strong> {{ order.shippingAddress || '—' }}</p>
          <p><strong>Thanh toán:</strong> {{ paymentLabel }}</p>
          <p v-if="payError" class="elegant-alert elegant-alert--error">{{ payError }}</p>
          <button
            v-if="order.rawStatus === 'PENDING' || order.status === 'pending'"
            type="button"
            class="btn-elegant-primary btn-interactive"
            style="margin: 0.75rem 0"
            :disabled="paying"
            @click="payAgain"
          >
            {{ paying ? 'Đang mở cổng...' : 'Thanh toán MoMo / VNPay' }}
          </button>

          <div class="elegant-cart-table elegant-cart-table--order">
            <div class="elegant-cart-table__head">
              <span>Sản phẩm</span>
              <span>Số lượng</span>
              <span>Đơn giá</span>
              <span>Thành tiền</span>
            </div>
            <div v-for="item in order.items" :key="item.productId" class="elegant-cart-row">
              <div class="elegant-cart-row__product">
                <img
                  :src="productsById[item.productId]?.imageUrl ?? 'https://placehold.co/80x80/f3f5f7/737373?text=SP'"
                  :alt="item.productName"
                />
                <div>
                  <div class="elegant-cart-row__name">{{ item.productName }}</div>
                  <SellerShopTag
                    v-if="productsById[item.productId]"
                    :product="productsById[item.productId]"
                    size="sm"
                    class="order-item-seller-tag"
                  />
                  <template v-if="order.status === 'delivered'">
                    <OrderProductReview
                      v-if="itemReviewState(item.productId).canReview"
                      :product-id="item.productId"
                      :product-name="item.productName"
                      @submitted="onReviewSubmitted(item.productId)"
                    />
                    <span
                      v-else
                      class="review-link review-link--muted"
                      :title="itemReviewState(item.productId).message"
                    >
                      {{ itemReviewState(item.productId).label }}
                    </span>
                  </template>
                </div>
              </div>
              <span>{{ item.quantity }}</span>
              <span class="elegant-cart-row__unit">{{ formatVnd(item.unitPrice) }}</span>
              <strong class="elegant-cart-row__subtotal">
                {{ formatVnd(item.unitPrice * item.quantity) }}
              </strong>
            </div>
          </div>

          <div class="elegant-summary__total" style="justify-content: flex-end; margin-top: 1.5rem">
            <span>Tổng</span>
            <strong>{{ formatVnd(order.total) }}</strong>
          </div>

          <div v-if="order.status === 'delivered'" class="elegant-order-actions" style="margin-top: 1rem">
            <p class="elegant-muted">{{ reviewWindowNote }}</p>
          </div>

          <div v-if="canCancel" class="elegant-order-actions" style="margin-top: 1.25rem">
            <button
              type="button"
              class="btn-elegant-outline btn-interactive"
              :disabled="cancelling"
              @click="cancelOrder"
            >
              {{ cancelling ? 'Đang hủy...' : 'Hủy đơn hàng' }}
            </button>
          </div>

          <RouterLink to="/orders" class="btn-elegant-outline btn-interactive" style="margin-top: 1.5rem; display: inline-flex">
            ← Quay lại đơn hàng
          </RouterLink>
        </div>
      </template>
    </div>

    <NewsletterBanner />
  </div>
  <p v-else class="empty container">Không tìm thấy đơn hàng</p>
</template>

<style scoped>
.order-track-panel {
  margin: 1.25rem 0 1.5rem;
  padding: 1rem 1.15rem;
  background: var(--surface-muted, #f8fafc);
  border-radius: 10px;
}

.order-track-panel__title {
  margin: 0 0 0.35rem;
  font-size: 1rem;
}

.order-item-seller-tag {
  display: inline-flex;
  margin: 0.35rem 0 0.25rem;
}

.review-link--muted {
  color: var(--slate-400, #94a3b8);
  cursor: default;
  text-decoration: none;
  font-size: 0.8125rem;
}
</style>
