<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatVnd, orderApi } from '@/api/services'
import type { Order } from '@/types'
import { isMobileBrowser, momoTransferDeeplink, momoTransferQrImageUrl, openMomoTransfer } from '@/utils/momoTransfer'
import { resolvePublicAssetUrl } from '@/utils/productImage'
import CheckoutStepper from '@/components/CheckoutStepper.vue'
import NewsletterBanner from '@/components/NewsletterBanner.vue'

const route = useRoute()
const router = useRouter()
const order = ref<Order | null>(null)
const loading = ref(true)
const error = ref('')
const completing = ref(false)
const qrImageFailed = ref(false)

const AUTO_COMPLETE_MS = 6_000
let autoCompleteTimer: ReturnType<typeof setTimeout> | undefined

const transfer = computed(() => order.value?.momoTransfer)
const amount = computed(() => transfer.value?.amount ?? order.value?.total ?? 0)
const note = computed(() => transfer.value?.transferNote ?? '')
const phone = computed(() => transfer.value?.sellerMomoPhone ?? '')
const qrUrl = computed(() => resolvePublicAssetUrl(transfer.value?.sellerMomoQrUrl))
const storeName = computed(() => transfer.value?.sellerStoreName ?? 'Shop')
const isPending = computed(
  () =>
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
  if (!deeplink.value && !qrUrl.value) return ''
  if (qrUrl.value && !qrImageFailed.value) return qrUrl.value
  return generatedQrUrl.value
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

async function completePayment() {
  if (!order.value || completing.value || !isPending.value) return
  clearAutoCompleteTimers()
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
  }
}

function clearAutoCompleteTimers() {
  if (autoCompleteTimer) {
    clearTimeout(autoCompleteTimer)
    autoCompleteTimer = undefined
  }
}

function startAutoComplete() {
  if (!isPending.value || !order.value) return
  clearAutoCompleteTimers()
  autoCompleteTimer = setTimeout(() => {
    void completePayment()
  }, AUTO_COMPLETE_MS)
}

function launchMomo() {
  if (!phone.value || !isPending.value) return
  openMomoTransfer(phone.value, amount.value, note.value)
}

async function load() {
  loading.value = true
  error.value = ''
  qrImageFailed.value = false
  try {
    order.value = await orderApi.getById(String(route.params.id))
    if (!order.value) {
      error.value = 'Không tìm thấy đơn hàng'
      return
    }
    const isMomoQr =
      order.value.paymentMethod === 'momo_qr' ||
      order.value.momoTransfer != null
    if (!isMomoQr) {
      await router.replace({ name: 'order-detail', params: { id: order.value.id } })
      return
    }
    if (!order.value.momoTransfer) {
      error.value = 'Chưa tải được thông tin chuyển MoMo. Thử reload trang.'
    }
    if (order.value.status === 'confirmed' || order.value.rawStatus === 'PAID') {
      await router.replace({
        name: 'order-detail',
        params: { id: order.value.id },
        query: { view: 'detail' },
      })
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được đơn'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load().then(() => {
    if (isPending.value && phone.value && isMobileBrowser()) {
      window.setTimeout(() => launchMomo(), 600)
    }
    if (isPending.value) {
      startAutoComplete()
    }
  })
})

onUnmounted(() => {
  clearAutoCompleteTimers()
})
</script>

<template>
  <div class="elegant-page">
    <div class="elegant-page__inner">
      <h1 class="elegant-page-title elegant-page-title--center">Chuyển MoMo tới shop</h1>
      <CheckoutStepper :step="3" />

      <p v-if="loading" class="empty">Đang tải…</p>
      <p v-else-if="error" class="elegant-alert elegant-alert--error">{{ error }}</p>

      <div v-else-if="order" class="momo-pay">
        <template v-if="transfer">
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
            <p class="elegant-muted">{{ qrCaption }}</p>
          </div>

          <dl class="momo-pay__fields">
            <div class="momo-pay__row">
              <dt>Số tiền</dt>
              <dd><strong>{{ formatVnd(amount) }}</strong></dd>
            </div>
            <div class="momo-pay__row">
              <dt>Nội dung CK</dt>
              <dd><code>{{ note }}</code></dd>
            </div>
            <div v-if="phone" class="momo-pay__row">
              <dt>SĐT MoMo shop</dt>
              <dd>{{ phone }}</dd>
            </div>
          </dl>

          <div class="momo-pay__actions">
            <button
              v-if="phone && isPending"
              type="button"
              class="btn-elegant-primary btn-interactive"
              :disabled="completing"
              @click="launchMomo"
            >
              Mở MoMo & chuyển tiền
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
          </p>
        </template>
        <p v-else class="elegant-muted" style="text-align: center">
          Đơn dùng MoMo shop nhưng chưa có QR/SĐT từ API.
          <RouterLink :to="`/orders/${order.id}`">Mở chi tiết đơn</RouterLink>
        </p>
      </div>
    </div>
    <NewsletterBanner />
  </div>
</template>

<style scoped>
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
