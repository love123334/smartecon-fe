<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatVnd, orderApi } from '@/api/services'
import type { Order } from '@/types'
import type { PaymentInfo } from '@/api/real/payments'
import CheckoutStepper from '@/components/CheckoutStepper.vue'
import NewsletterBanner from '@/components/NewsletterBanner.vue'
import { mapPaymentMethodLabel } from '@/api/real/payments'
import { backendStatusLabel } from '@/utils/backendOrderStatus'

const PENDING_PAY_KEY = 'sedsp_pending_vnpay_order'

const route = useRoute()
const router = useRouter()

const order = ref<Order | null>(null)
const payment = ref<PaymentInfo | null>(null)
const loading = ref(true)
const confirming = ref(false)
const paying = ref(false)
const error = ref('')
const pollHint = ref('')

let pollTimer: ReturnType<typeof setInterval> | null = null
let pollCount = 0

const gateway = computed(() => String(route.query.gateway ?? 'vnpay'))
const queryStatus = computed(() => String(route.query.status ?? ''))
const orderId = computed(() => String(route.query.orderId ?? ''))
const responseCode = computed(() => String(route.query.code ?? ''))
const isMock = computed(() => route.query.mock === '1')

const gatewayLabel = computed(() => {
  if (gateway.value === 'vnpay') return 'VNPay'
  return gateway.value || 'Cổng thanh toán'
})

/** Confirmed paid from BE (preferred) or successful return query. */
const isPaid = computed(() => {
  if (payment.value?.status === 'SUCCESS') return true
  if (order.value?.rawStatus === 'PAID') return true
  if (['confirmed', 'shipping', 'delivered'].includes(order.value?.status ?? '')) {
    return order.value?.paymentMethod === 'vnpay' || queryStatus.value === 'success'
  }
  return false
})

const isPendingPay = computed(() => {
  if (isPaid.value) return false
  if (order.value?.rawStatus === 'CANCELLED' || order.value?.status === 'cancelled') return false
  if (payment.value?.status === 'FAILED') return false
  return (
    queryStatus.value === 'cancelled' ||
    queryStatus.value === 'failed' ||
    queryStatus.value === '' ||
    payment.value?.status === 'PENDING' ||
    order.value?.rawStatus === 'PENDING' ||
    order.value?.status === 'pending'
  )
})

const headline = computed(() => {
  if (isPaid.value) return 'Thanh toán thành công'
  if (order.value?.rawStatus === 'CANCELLED' || payment.value?.status === 'FAILED') {
    return 'Thanh toán thất bại'
  }
  if (queryStatus.value === 'cancelled' || responseCode.value === '24') {
    return 'Bạn đã hủy / thoát khỏi VNPay'
  }
  return 'Đang chờ xác nhận thanh toán'
})

const headlineColor = computed(() => {
  if (isPaid.value) return '#1a7f4e'
  if (order.value?.rawStatus === 'CANCELLED' || payment.value?.status === 'FAILED') return '#b42318'
  return '#9a3412'
})

onMounted(async () => {
  await refreshAll(true)
  if (!isPaid.value && orderId.value) {
    startPolling()
  }
})

onUnmounted(() => stopPolling())

function startPolling() {
  stopPolling()
  pollCount = 0
  pollHint.value = 'Đang đồng bộ trạng thái từ VNPay…'
  pollTimer = setInterval(() => {
    pollCount += 1
    void refreshAll(false)
    if (isPaid.value || pollCount >= 12) {
      stopPolling()
      if (!isPaid.value) {
        pollHint.value =
          'Chưa nhận được xác nhận tự động. Nếu bạn đã quét QR / chuyển khoản thành công, bấm «Tôi đã thanh toán».'
      }
    }
  }, 2500)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function refreshAll(initial: boolean) {
  if (initial) {
    loading.value = true
    error.value = ''
  }
  try {
    if (orderId.value) {
      const [o, p] = await Promise.all([
        orderApi.getById(orderId.value),
        orderApi.getPayment(orderId.value),
      ])
      order.value = o
      payment.value = p
    }
    if (isPaid.value) {
      clearPending()
      stopPolling()
      pollHint.value = ''
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được đơn hàng'
  } finally {
    if (initial) loading.value = false
  }
}

function clearPending() {
  try {
    sessionStorage.removeItem(PENDING_PAY_KEY)
  } catch {
    /* ignore */
  }
}

async function confirmPaid() {
  if (!orderId.value) return
  confirming.value = true
  error.value = ''
  pollHint.value = 'Đang kiểm tra với máy chủ…'
  try {
    await refreshAll(false)
    if (isPaid.value) {
      pollHint.value = 'Đã xác nhận thanh toán thành công.'
      return
    }
    // One more delayed check (IPN may lag behind return URL)
    await new Promise((r) => setTimeout(r, 1500))
    await refreshAll(false)
    if (isPaid.value) {
      pollHint.value = 'Đã xác nhận thanh toán thành công.'
    } else {
      pollHint.value =
        'Hệ thống chưa ghi nhận SUCCESS. Đợi thêm vài giây rồi thử lại, hoặc mở lại VNPay nếu giao dịch chưa hoàn tất.'
      startPolling()
    }
  } finally {
    confirming.value = false
  }
}

async function retryPay() {
  if (!order.value) return
  paying.value = true
  error.value = ''
  try {
    try {
      sessionStorage.setItem(PENDING_PAY_KEY, String(order.value.id))
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
      return
    }
    error.value = 'Không nhận được link thanh toán từ VNPay'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không thể khởi tạo thanh toán'
  } finally {
    paying.value = false
  }
}

const orderStatusDisplay = computed(() => {
  if (order.value?.rawStatus) return backendStatusLabel(order.value.rawStatus)
  if (order.value?.status === 'confirmed') return 'Đã thanh toán / xác nhận'
  return order.value?.status ?? '—'
})
</script>

<template>
  <div class="elegant-page">
    <div class="container elegant-page__inner" style="max-width: 640px">
      <h1 class="elegant-page-title">Kết quả thanh toán</h1>
      <CheckoutStepper :step="3" />

      <div v-if="loading" class="empty">Đang tải kết quả thanh toán…</div>

      <div v-else class="card card--flat" style="padding: 1.5rem">
        <p v-if="error" class="elegant-alert elegant-alert--error">{{ error }}</p>

        <h2 :style="{ marginTop: 0, color: headlineColor }">{{ headline }}</h2>

        <template v-if="isPaid">
          <p>
            Đơn <strong>#{{ orderId || order?.id }}</strong> đã được xác nhận thanh toán qua
            <strong>{{ gatewayLabel }}</strong>. Đơn đã lưu trong
            <RouterLink to="/orders">lịch sử đơn hàng</RouterLink>.
          </p>
          <p class="elegant-muted" style="font-size: 0.9rem">
            Email xác nhận sẽ được gửi tới hộp thư của bạn (và người bán) nếu máy chủ mail đã cấu hình.
          </p>
        </template>

        <template v-else-if="isPendingPay">
          <p>
            Nếu bạn <strong>đã quét QR / chuyển khoản thành công</strong> trên app ngân hàng, hãy đợi vài giây
            rồi bấm <strong>«Tôi đã thanh toán»</strong> để tải lại xác nhận từ hệ thống.
          </p>
          <p class="elegant-muted" style="font-size: 0.9rem">
            Sau khi thanh toán, VNPay sẽ tự đưa bạn về trang này. Nếu bạn đóng trang QR sớm, dùng nút xác nhận bên dưới.
          </p>
          <p v-if="pollHint" class="elegant-muted" style="font-size: 0.9rem">{{ pollHint }}</p>
        </template>

        <template v-else>
          <p>
            Giao dịch qua <strong>{{ gatewayLabel }}</strong> không thành công hoặc đơn đã hủy.
            Bạn có thể thử lại VNPay hoặc xem chi tiết đơn.
          </p>
        </template>

        <p v-if="isMock" class="elegant-muted" style="font-size: 0.9rem">
          (Chế độ mock — chưa gọi sandbox VNPay thật.)
        </p>

        <ul v-if="order || payment" style="list-style: none; padding: 0; margin: 1rem 0">
          <li v-if="order">
            Trạng thái đơn: <strong>{{ orderStatusDisplay }}</strong>
            <span v-if="order.rawStatus" class="elegant-muted"> ({{ order.rawStatus }})</span>
          </li>
          <li v-if="payment">
            Thanh toán: <strong>{{ payment.status }}</strong>
            <span v-if="payment.transactionId" class="elegant-muted">
              · mã GD {{ payment.transactionId }}
            </span>
          </li>
          <li v-if="order">Tổng: <strong>{{ formatVnd(order.total) }}</strong></li>
          <li v-if="order">
            Phương thức:
            <strong>{{
              order.paymentMethod === 'vnpay'
                ? 'VNPay'
                : order.paymentMethod === 'cod'
                  ? 'COD'
                  : mapPaymentMethodLabel(order.paymentMethod?.toUpperCase())
            }}</strong>
          </li>
          <li v-if="responseCode" class="elegant-muted">Mã phản hồi VNPay: {{ responseCode }}</li>
        </ul>

        <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.25rem">
          <button
            v-if="!isPaid && orderId"
            type="button"
            class="btn-elegant-primary btn-interactive"
            :disabled="confirming"
            @click="confirmPaid"
          >
            {{ confirming ? 'Đang xác nhận…' : 'Tôi đã thanh toán — Xác nhận' }}
          </button>

          <RouterLink
            v-if="orderId || order?.id"
            class="btn-elegant-primary btn-interactive"
            :to="`/orders/${orderId || order?.id}`"
          >
            Xem đơn hàng
          </RouterLink>

          <button
            v-if="!isPaid && order && order.rawStatus === 'PENDING'"
            type="button"
            class="btn-interactive"
            :disabled="paying"
            @click="retryPay"
          >
            {{ paying ? 'Đang mở cổng…' : 'Mở lại VNPay' }}
          </button>

          <RouterLink class="btn-interactive" to="/orders">Đơn của tôi</RouterLink>
          <RouterLink class="btn-interactive" to="/">Tiếp tục mua</RouterLink>
        </div>
      </div>
    </div>
    <NewsletterBanner />
  </div>
</template>
