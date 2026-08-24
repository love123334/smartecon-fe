<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { formatVnd, orderApi, reviewApi } from '@/api/services'
import type { Order, ProductReview } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { orderStatusLabel } from '@/utils/orderStatus'
import { canShopAsBuyer } from '@/utils/roleNav'
import { REVIEW_WINDOW_DAYS, checkReviewEligibility } from '@/utils/reviewEligibility'
import EmptyState from '@/components/EmptyState.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import OrderTrackStepper from '@/components/OrderTrackStepper.vue'
import OrderProductReview from '@/components/OrderProductReview.vue'
import PageHeader from '@/components/PageHeader.vue'

const auth = useAuthStore()
const router = useRouter()
const orders = ref<Order[]>([])
const loading = ref(true)
const error = ref('')
const expandedId = ref<string | null>(null)
const reviewsByProduct = ref<Record<string, ProductReview[]>>({})

onMounted(async () => {
  if (!auth.user) {
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    orders.value = await orderApi.listForCustomer(auth.user.id)
    const deliveredIds = [
      ...new Set(
        orders.value
          .filter((o) => o.status === 'delivered')
          .flatMap((o) => o.items.map((i) => i.productId)),
      ),
    ]
    await Promise.all(
      deliveredIds.slice(0, 12).map(async (pid) => {
        try {
          reviewsByProduct.value[pid] = await reviewApi.list(pid)
        } catch {
          reviewsByProduct.value[pid] = []
        }
      }),
    )
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được lịch sử mua hàng'
    orders.value = []
  } finally {
    loading.value = false
  }
})

function statusClass(s: string) {
  return `badge badge-${s}`
}

function primaryProductId(order: Order): string | null {
  return order.items[0]?.productId ?? null
}

/** Một SP → vào trang SP; nhiều SP → mở danh sách để chọn */
function onViewProduct(order: Order) {
  const items = order.items
  if (items.length === 1) {
    void router.push({ name: 'product-detail', params: { id: items[0].productId } })
    return
  }
  if (items.length > 1) {
    expandedId.value = expandedId.value === order.id ? null : order.id
    return
  }
}

function itemEligibility(order: Order, productId: string) {
  return checkReviewEligibility({
    isLoggedIn: auth.isLoggedIn,
    isCustomer: canShopAsBuyer(auth.role),
    productId,
    orders: [order],
    existingReviews: reviewsByProduct.value[productId] ?? [],
    currentUserId: auth.user?.backendId ?? auth.user?.id,
  })
}

function canReviewItem(order: Order, productId: string): boolean {
  if (order.status !== 'delivered') return false
  return itemEligibility(order, productId).canReview
}

function orderCanReview(order: Order): boolean {
  if (order.status !== 'delivered') return false
  return order.items.some((item) => canReviewItem(order, item.productId))
}

function reviewBlockNote(order: Order, productId: string): string {
  const result = itemEligibility(order, productId)
  if (result.canReview) return ''
  if (result.reason === 'already_reviewed') return 'Bạn đã đánh giá sản phẩm này.'
  if (result.reason === 'expired') return `Đã quá hạn đánh giá (${REVIEW_WINDOW_DAYS} ngày sau giao).`
  return result.message.replace(/\*\*/g, '')
}

function onReviewSubmitted(productId: string) {
  void reviewApi.list(productId).then((list) => {
    reviewsByProduct.value = { ...reviewsByProduct.value, [productId]: list }
  })
}

function showItems(order: Order): boolean {
  return expandedId.value === order.id || order.status === 'delivered' || order.items.length <= 1
}

function scrollToOrderReview(order: Order) {
  if (!orderCanReview(order)) {
    void router.push({
      name: 'order-detail',
      params: { id: order.id },
      query: { view: 'detail' },
      hash: '#reviews',
    })
    return
  }
  expandedId.value = order.id
  void nextTick(() => {
    document
      .getElementById(`order-${order.id}-reviews`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Khách hàng"
      title="Lịch sử mua hàng"
      lead="Theo dõi trạng thái từng đơn — từ chờ xác nhận đến đã giao. Đánh giá sản phẩm trong 30 ngày sau khi nhận hàng."
    />

    <LoadingSpinner
      v-if="loading"
      page
      label="Đang tải lịch sử đơn hàng..."
      sublabel="Đang đồng bộ trạng thái vận chuyển và thông tin đơn hàng."
    />
    <p v-else-if="error" class="form-error">{{ error }}</p>
    <EmptyState
      v-else-if="!orders.length"
      icon="📦"
      title="Chưa có đơn hàng"
      description="Giỏ hàng trống hoặc bạn chưa checkout. Thêm sản phẩm rồi thanh toán để thấy lịch sử tại đây."
    >
      <RouterLink to="/search" class="btn btn-primary" style="margin-top: 1rem; display: inline-flex">
        Mua sắm ngay
      </RouterLink>
    </EmptyState>
    <div v-else class="orders-track-list">
      <article v-for="o in orders" :key="o.id" class="card orders-track-card">
        <div class="orders-track-card__row">
          <div>
            <strong>#{{ o.id }}</strong>
            <p class="muted">
              {{ new Date(o.createdAt).toLocaleString('vi-VN') }}
              · {{ o.items.length }} sản phẩm
            </p>
          </div>
          <div class="orders-track-card__meta">
            <span>{{ formatVnd(o.total) }}</span>
            <span :class="statusClass(o.status)">{{ orderStatusLabel(o.status) }}</span>
          </div>
        </div>

        <OrderTrackStepper :status="o.status" compact show-hint />

        <div class="orders-track-card__actions">
          <RouterLink
            v-if="o.items.length === 1 && primaryProductId(o)"
            :to="{ name: 'product-detail', params: { id: primaryProductId(o)! } }"
            class="btn btn-sm"
          >
            Xem sản phẩm
          </RouterLink>
          <button
            v-else-if="o.items.length > 1"
            type="button"
            class="btn btn-sm"
            @click="onViewProduct(o)"
          >
            {{ expandedId === o.id ? 'Ẩn danh sách SP' : 'Xem sản phẩm' }}
          </button>
          <button
            v-if="orderCanReview(o)"
            type="button"
            class="btn btn-outline btn-sm"
            @click="scrollToOrderReview(o)"
          >
            Đánh giá đơn
          </button>
          <RouterLink
            :to="{ name: 'order-detail', params: { id: o.id }, query: { view: 'detail' }, hash: '#track' }"
            class="btn btn-primary btn-sm"
          >
            Chi tiết &amp; theo dõi
          </RouterLink>
        </div>

        <ul v-if="showItems(o)" :id="`order-${o.id}-reviews`" class="orders-track-card__items">
          <li v-for="item in o.items" :key="item.productId" class="orders-track-item">
            <div class="orders-track-item__head">
              <RouterLink
                class="orders-track-item__name"
                :to="{ name: 'product-detail', params: { id: item.productId } }"
              >
                {{ item.productName }} × {{ item.quantity }}
              </RouterLink>
              <RouterLink
                class="orders-track-item__link"
                :to="{ name: 'product-detail', params: { id: item.productId } }"
              >
                Xem SP →
              </RouterLink>
            </div>
            <OrderProductReview
              v-if="canReviewItem(o, item.productId)"
              :product-id="item.productId"
              :product-name="item.productName"
              @submitted="onReviewSubmitted(item.productId)"
            />
            <p
              v-else-if="o.status === 'delivered' && reviewBlockNote(o, item.productId)"
              class="orders-track-item__note"
            >
              {{ reviewBlockNote(o, item.productId) }}
            </p>
          </li>
        </ul>
      </article>
    </div>
  </div>
</template>

<style scoped>
.orders-track-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.orders-track-card {
  padding: 1rem 1.15rem;
}

.orders-track-card__row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: flex-start;
}

.orders-track-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  font-weight: 600;
}

.orders-track-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.orders-track-card__items {
  margin: 0.85rem 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.orders-track-item {
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--line, #e4e9f2);
  border-radius: 10px;
  background: #fafbfc;
}

.orders-track-item__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.orders-track-item__name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--navy, #14275c);
  text-decoration: none;
}

.orders-track-item__name:hover {
  color: var(--primary-600, #2e7df6);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.orders-track-item__link {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--primary-700, #1f63d4);
  text-decoration: none;
  white-space: nowrap;
}

.orders-track-item__link:hover {
  text-decoration: underline;
}

.orders-track-item__note {
  margin: 0.35rem 0 0;
  font-size: 0.8rem;
  color: var(--slate-500, #64748b);
}

.muted {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: var(--slate-500, #64748b);
  font-weight: 400;
}
</style>
