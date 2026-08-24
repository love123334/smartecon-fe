<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatVnd, orderApi, productApi, sellerMomoApi } from '@/api/services'
import type { Order } from '@/types'
import { isMobileBrowser, momoTransferDeeplink, momoTransferQrImageUrl, openMomoTransfer } from '@/utils/momoTransfer'
import { resolvePublicAssetUrl } from '@/utils/productImage'
import { clearApiCache } from '@/api/http/client'
import CheckoutStepper from '@/components/CheckoutStepper.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import NewsletterBanner from '@/components/NewsletterBanner.vue'

const route = useRoute()
const router = useRouter()
const order = ref<Order | null>(null)
const loading = ref(true)
const error = ref('')
const completing = ref(false)
const processingPayment = ref(false)
const processingCountdown = ref(0)
const qrImageFailed = ref(false)
const copiedField = ref<string | null>(null)

const sellerPhone = ref('0901234567')
const sellerQrUrl = ref('')
const sellerStoreName = ref('SEDSP Shop')

const AUTO_COMPLETE_MS = 7_000
let autoCompleteTimer: ReturnType<typeof setTimeout> | undefined

const PAYMENT_PROCESSING_MS = 1_500
let countdownTimer: ReturnType<typeof setInterval> | undefined

function clearAutoTimer() {
  if (autoCompleteTimer) {
    clearTimeout(autoCompleteTimer)
    autoCompleteTimer = undefined
  }
}

function startAutoDirect() {
  if (!isPending.value || !order.value) return
  clearAutoTimer()
  autoCompleteTimer = setTimeout(() => {
    clearAutoTimer()
    void completePayment()
  }, AUTO_COMPLETE_MS)
}

const transfer = computed(() => {
  if (order.value?.momoTransfer) {
    return order.value.momoTransfer
  }
  if (order.value) {
    return {
      amount: order.value.total ?? 0,
      transferNote: `SEDSP ${order.value.id}`,
      sellerMomoPhone: sellerPhone.value,
      sellerMomoQrUrl: sellerQrUrl.value || undefined,
      sellerStoreName: sellerStoreName.value,
      configured: true,
    }
  }
  return null
})

const amount = computed(() => transfer.value?.amount ?? order.value?.total ?? 0)
const note = computed(() => transfer.value?.transferNote || (order.value ? `SEDSP ${order.value.id}` : ''))
const phone = computed(() => transfer.value?.sellerMomoPhone || sellerPhone.value)
const qrUrl = computed(() => resolvePublicAssetUrl(transfer.value?.sellerMomoQrUrl || sellerQrUrl.value))
const storeName = computed(() => transfer.value?.sellerStoreName || sellerStoreName.value)

const isPending = computed(
  () =>
    !order.value?.status ||
    order.value?.status === 'pending' ||
    order.value?.rawStatus === 'PENDING',
)

const deeplink = computed(() => {
  if (!phone.value) return ''
  return momoTransferDeeplink(phone.value, amount.value, note.value)
})

const generatedQrUrl = computed(() =>
  deeplink.value ? momoTransferQrImageUrl(deeplink.value) : '',
)

const displayQrUrl = computed(() => {
  if (qrUrl.value && !qrImageFailed.value) return qrUrl.value
  if (generatedQrUrl.value) return generatedQrUrl.value
  if (phone.value) {
    return momoTransferQrImageUrl(momoTransferDeeplink(phone.value, amount.value, note.value))
  }
  return ''
})

const qrCaption = computed(() =>
  qrUrl.value && !qrImageFailed.value
    ? 'Quét QR MoMo của shop'
    : 'QR chuyển tiền (MoMo tự điền số tiền & nội dung)',
)

function onQrError() {
  if (qrUrl.value && !qrImageFailed.value) {
    qrImageFailed.value = true
  }
}

async function copyText(text: string, field: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedField.value = field
    window.setTimeout(() => {
      if (copiedField.value === field) copiedField.value = null
    }, 2000)
  } catch {
    /* ignore clipboard error */
  }
}

async function completePayment() {
  if (!order.value || completing.value || processingPayment.value || !isPending.value) return
  clearAutoTimer()
  processingPayment.value = true
  processingCountdown.value = Math.ceil(PAYMENT_PROCESSING_MS / 1000)
  countdownTimer = setInterval(() => {
    processingCountdown.value = Math.max(0, processingCountdown.value - 1)
  }, 1000)
  await new Promise((r) => setTimeout(r, PAYMENT_PROCESSING_MS))
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = undefined
  }
  completing.value = true
  error.value = ''
  try {
    const updated = await orderApi.completeMomoTransfer(String(order.value.id))
    order.value = updated
    await router.replace({
      name: 'order-detail',
      params: { id: String(updated.id) },
      query: { view: 'detail' },
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không xác nhận được thanh toán'
  } finally {
    completing.value = false
    processingPayment.value = false
    processingCountdown.value = 0
  }
}

function launchMomo() {
  if (!phone.value || !isPending.value) return
  openMomoTransfer(phone.value, amount.value, note.value)
}

async function load() {
  const id = String(route.params.id || '')
  if (!id) return
  loading.value = true
  error.value = ''
  qrImageFailed.value = false
  clearApiCache(`/orders/${id}`)
  try {
    order.value = await orderApi.getById(id)
    if (!order.value) {
      order.value = {
        id,
        customerId: '',
        customerName: 'Khách hàng',
        items: [],
        total: 0,
        status: 'pending',
        rawStatus: 'PENDING',
        paymentMethod: 'momo_qr',
        shippingAddress: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    }

    if (!order.value.momoTransfer) {
      try {
        const firstItem = order.value.items?.[0]
        if (firstItem?.productId) {
          const prod = await productApi.getById(firstItem.productId, { withStock: false })
          if (prod?.sellerId) {
            const pubMomo = await sellerMomoApi.getPublic(prod.sellerId)
            if (pubMomo) {
              if (pubMomo.momoPhone) sellerPhone.value = pubMomo.momoPhone
              if (pubMomo.momoQrUrl) sellerQrUrl.value = pubMomo.momoQrUrl
              if (pubMomo.storeName) sellerStoreName.value = pubMomo.storeName
            }
          }
        }
      } catch {
        /* fallback default */
      }
    }

    if (isPending.value) {
      startAutoDirect()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được đơn'
  } finally {
    loading.value = false
  }
}

watch(
  () => [route.params.id, route.query.placed] as const,
  ([id]) => {
    if (id) {
      void load().then(() => {
        if (isPending.value && phone.value && isMobileBrowser()) {
          window.setTimeout(() => launchMomo(), 600)
        }
      })
    }
  },
  { immediate: true },
)

onMounted(() => {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  if (!order.value && route.params.id) {
    void load()
  }
})

onUnmounted(() => {
  clearAutoTimer()
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = undefined
  }
})
</script>

<template>
  <div class="elegant-page">
    <div class="elegant-page__inner">
      <h1 class="elegant-page-title elegant-page-title--center">Chuyển MoMo tới shop</h1>
      <CheckoutStepper :step="3" />

      <LoadingSpinner v-if="loading" page label="Đang tải thông tin thanh toán…" />
      <p v-else-if="error" class="elegant-alert elegant-alert--error">{{ error }}</p>

      <div v-else-if="order" class="momo-pay">
        <div v-if="processingPayment" class="momo-pay__processing" role="status" aria-live="polite">
          <LoadingSpinner label="Đang xác nhận thanh toán…" />
          <p class="elegant-muted">
            Hệ thống đang đối soát giao dịch MoMo…
          </p>
        </div>
        <template v-else-if="transfer">
          <p class="momo-pay__lead">
            MoMo sẽ tự điền số tiền và nội dung chuyển khoản tới <strong>{{ storeName }}</strong>.
          </p>

          <div v-if="displayQrUrl" class="momo-pay__qr-wrap">
            <img
              :src="displayQrUrl"
              alt="QR MoMo shop"
              class="momo-pay__qr"
              loading="lazy"
              @error="onQrError"
            />
            <p class="elegant-muted" style="margin-top: 0.5rem">{{ qrCaption }}</p>
          </div>

          <dl class="momo-pay__fields">
            <div class="momo-pay__row">
              <dt>Số tiền</dt>
              <dd class="momo-pay__val-wrap">
                <strong style="font-size: 1.15rem; color: #dc2626">{{ formatVnd(amount) }}</strong>
                <button
                  type="button"
                  class="btn-copy"
                  title="Sao chép số tiền"
                  @click="copyText(String(amount), 'amount')"
                >
                  {{ copiedField === 'amount' ? '✓ Đã chép' : 'Sao chép' }}
                </button>
              </dd>
            </div>
            <div class="momo-pay__row">
              <dt>Nội dung CK</dt>
              <dd class="momo-pay__val-wrap">
                <code>{{ note }}</code>
                <button
                  type="button"
                  class="btn-copy"
                  title="Sao chép nội dung"
                  @click="copyText(note, 'note')"
                >
                  {{ copiedField === 'note' ? '✓ Đã chép' : 'Sao chép' }}
                </button>
              </dd>
            </div>
            <div v-if="phone" class="momo-pay__row">
              <dt>SĐT MoMo shop</dt>
              <dd class="momo-pay__val-wrap">
                <span>{{ phone }}</span>
                <button
                  type="button"
                  class="btn-copy"
                  title="Sao chép SĐT"
                  @click="copyText(phone, 'phone')"
                >
                  {{ copiedField === 'phone' ? '✓ Đã chép' : 'Sao chép' }}
                </button>
              </dd>
            </div>
          </dl>

          <div class="momo-pay__actions">
            <button
              v-if="phone && isPending"
              type="button"
              class="btn-elegant-primary btn-interactive"
              :disabled="completing || processingPayment"
              @click="launchMomo"
            >
              📲 Mở MoMo chuyển tiền
            </button>
            <button
              v-if="isPending"
              type="button"
              class="btn-elegant-primary btn-interactive"
              :disabled="completing || processingPayment"
              @click="completePayment"
            >
              ✅ Tôi đã chuyển tiền xong
            </button>
            <RouterLink
              class="btn-elegant-outline btn-interactive"
              :to="{ name: 'order-detail', params: { id: order.id }, query: { view: 'detail' } }"
            >
              Xem đơn #{{ order.id }}
            </RouterLink>
          </div>

          <p class="elegant-muted momo-pay__hint">
            Đơn #{{ order.id }} · Tổng {{ formatVnd(order.total) }}
            <template v-if="isPending">
              · Chụp màn hình mã QR hoặc chuyển đúng cú pháp để shop đối soát nhanh.
            </template>
          </p>
        </template>
        <p v-else class="elegant-muted" style="text-align: center">
          Đơn dùng MoMo shop nhưng chưa có thông tin chuyển khoản.
          <RouterLink :to="`/orders/${order.id}`">Mở chi tiết đơn</RouterLink>
        </p>
      </div>
    </div>
    <NewsletterBanner />
  </div>
</template>

<style scoped>
.momo-pay__processing {
  text-align: center;
  padding: 2rem 1rem;
}

.momo-pay__processing .elegant-muted {
  margin-top: 0.75rem;
  font-size: 0.9rem;
}

.momo-pay {
  max-width: 480px;
  margin: 1.5rem auto 0;
}

.momo-pay__lead {
  text-align: center;
  line-height: 1.55;
  margin-bottom: 1.25rem;
}

.momo-pay__qr-wrap {
  text-align: center;
  margin-bottom: 1.25rem;
}

.momo-pay__qr {
  max-width: 240px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.momo-pay__fields {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.momo-pay__row {
  display: grid;
  grid-template-columns: 7rem 1fr;
  gap: 0.5rem;
  align-items: start;
  padding: 0.65rem 0;
  border-bottom: 1px solid #f3f4f6;
}

.momo-pay__row dt {
  font-size: 0.85rem;
  color: #6b7280;
  margin: 0;
}

.momo-pay__row dd {
  margin: 0;
}

.momo-pay__val-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.btn-copy {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid #d1d5db;
  background: #f9fafb;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-copy:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
  color: #111827;
}

.btn-copy:active {
  transform: scale(0.96);
}

.momo-pay__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  justify-content: center;
  margin-top: 1.25rem;
}

.momo-pay__hint {
  text-align: center;
  font-size: 0.85rem;
  margin-top: 1rem;
}
</style>
