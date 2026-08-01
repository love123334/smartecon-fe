<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatVnd, orderApi } from '@/api/services'
import type { Order } from '@/types'
import CheckoutStepper from '@/components/CheckoutStepper.vue'
import NewsletterBanner from '@/components/NewsletterBanner.vue'
import { mapPaymentMethodLabel } from '@/api/real/payments'

const PENDING_PAY_KEY = 'sedsp_pending_vnpay_order'

const route = useRoute()
const router = useRouter()

const order = ref<Order | null>(null)
const loading = ref(true)
const paying = ref(false)
const error = ref('')

const gateway = computed(() => String(route.query.gateway ?? 'vnpay'))
const status = computed(() => String(route.query.status ?? ''))
const orderId = computed(() => String(route.query.orderId ?? ''))
const isSuccess = computed(() => status.value === 'success')
const isMock = computed(() => route.query.mock === '1')

const gatewayLabel = computed(() => {
  if (gateway.value === 'vnpay') return 'VNPay'
  return gateway.value || 'Cổng thanh toán'
})

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    if (orderId.value) {
      order.value = await orderApi.getById(orderId.value)
    }
    if (isSuccess.value) {
      try {
        sessionStorage.removeItem(PENDING_PAY_KEY)
      } catch {
        /* ignore */
      }
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được đơn hàng'
  } finally {
    loading.value = false
  }
})

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
</script>

<template>
  <div class="elegant-page">
    <div class="container elegant-page__inner" style="max-width: 640px">
      <h1 class="elegant-page-title">Kết quả thanh toán</h1>
      <CheckoutStepper :step="3" />

      <div v-if="loading" class="empty">Đang tải...</div>

      <div v-else class="card card--flat" style="padding: 1.5rem">
        <p v-if="error" class="elegant-alert elegant-alert--error">{{ error }}</p>

        <template v-if="isSuccess">
          <h2 style="margin-top: 0; color: #1a7f4e">Thanh toán thành công</h2>
          <p>
            Đơn <strong>#{{ orderId || order?.id }}</strong> đã được xác nhận qua
            <strong>{{ gatewayLabel }}</strong>.
          </p>
        </template>
        <template v-else>
          <h2 style="margin-top: 0; color: #b42318">Thanh toán chưa hoàn tất</h2>
          <p>
            Giao dịch qua <strong>{{ gatewayLabel }}</strong> không thành công hoặc bị hủy / Back.
            Bạn có thể thử lại VNPay hoặc xem chi tiết đơn.
          </p>
        </template>

        <p v-if="isMock" class="elegant-muted" style="font-size: 0.9rem">
          (Chế độ mock — chưa gọi sandbox VNPay thật.)
        </p>

        <ul v-if="order" style="list-style: none; padding: 0; margin: 1rem 0">
          <li>Trạng thái đơn: <strong>{{ order.rawStatus || order.status }}</strong></li>
          <li>Tổng: <strong>{{ formatVnd(order.total) }}</strong></li>
          <li>
            Phương thức:
            <strong>{{
              order.paymentMethod === 'vnpay'
                ? 'VNPay'
                : order.paymentMethod === 'cod'
                  ? 'COD'
                  : mapPaymentMethodLabel(order.paymentMethod?.toUpperCase())
            }}</strong>
          </li>
        </ul>

        <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.25rem">
          <RouterLink
            v-if="orderId || order?.id"
            class="btn-elegant-primary btn-interactive"
            :to="`/orders/${orderId || order?.id}`"
          >
            Xem đơn hàng
          </RouterLink>
          <button
            v-if="!isSuccess && order"
            type="button"
            class="btn-elegant-primary btn-interactive"
            :disabled="paying"
            @click="retryPay"
          >
            {{ paying ? 'Đang mở cổng...' : 'Thanh toán lại VNPay' }}
          </button>
          <RouterLink class="btn-interactive" to="/orders">Đơn của tôi</RouterLink>
          <RouterLink class="btn-interactive" to="/">Tiếp tục mua</RouterLink>
        </div>
      </div>
    </div>
    <NewsletterBanner />
  </div>
</template>
