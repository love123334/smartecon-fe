<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatVnd } from '@/api/services'
import { useCartStore } from '@/stores/cart'
import { useNoticeStore } from '@/stores/notice'
import QuantityStepper from '@/components/QuantityStepper.vue'
import CheckoutStepper from '@/components/CheckoutStepper.vue'
import EmptyState from '@/components/EmptyState.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import {
  peekPendingVoucherCode,
  rememberPendingVoucherCode,
  validateCartVoucher,
  voucherUserMessage,
} from '@/utils/voucherCheckout'

const PENDING_PAY_KEY = 'sedsp_pending_vnpay_order'
const PAY_RETURN_KEY = 'sedsp_pay_return'

const cart = useCartStore()
const route = useRoute()
const router = useRouter()
const notice = useNoticeStore()
const shipping = ref<'free' | 'express' | 'pickup'>('free')
const coupon = ref('')
const couponApplied = ref(false)
const couponDiscount = ref(0)
const couponMessage = ref('')
const couponIsError = ref(false)
const couponLoading = ref(false)
const payBanner = ref<{ kind: 'ok' | 'warn' | 'err'; text: string; orderId?: string } | null>(null)
const checkoutLoading = ref(false)

const shippingFee = computed(() => {
  if (shipping.value === 'express') return 35_000
  if (shipping.value === 'pickup') return 0
  return cart.total >= 500_000 ? 0 : 30_000
})

const discount = computed(() => (couponApplied.value ? couponDiscount.value : 0))
const grandTotal = computed(() => Math.max(0, cart.total + shippingFee.value - discount.value))

const cartSellerIds = computed(() => {
  const ids = new Set<string>()
  for (const line of cart.lines) {
    const sid = line.product.sellerId?.trim()
    if (sid) ids.add(sid)
  }
  return [...ids]
})
const singleSellerId = computed(() =>
  cartSellerIds.value.length === 1 ? cartSellerIds.value[0] : null,
)

function applyPayStatus(pay: string, orderId: string, gateway: string) {
  const g = gateway.toUpperCase() || 'VNPAY'
  if (pay === 'success') {
    try {
      sessionStorage.removeItem(PENDING_PAY_KEY)
    } catch {
      /* ignore */
    }
    payBanner.value = {
      kind: 'ok',
      orderId,
      text: orderId
        ? `Thanh toán ${g} thành công — đơn #${orderId} đã ghi nhận.`
        : `Thanh toán ${g} thành công.`,
    }
    notice.show({
      kind: 'info',
      title: 'Thanh toán thành công',
      message: orderId ? `Đơn #${orderId} đã được thanh toán.` : 'Giao dịch thành công.',
      durationMs: 3200,
    })
  } else if (pay === 'cancelled') {
    payBanner.value = {
      kind: 'warn',
      orderId,
      text: orderId
        ? `Bạn đã hủy / thoát cổng ${g}. Đơn #${orderId} vẫn chờ — có thể thanh toán lại từ đơn hàng.`
        : `Bạn đã hủy cổng ${g}.`,
    }
    notice.show({
      kind: 'info',
      title: 'Đã hủy thanh toán',
      message: 'Đơn vẫn chờ. Mở lại VNPay từ đơn hàng nếu muốn tiếp tục.',
      durationMs: 3600,
    })
  } else {
    payBanner.value = {
      kind: 'err',
      orderId,
      text: orderId
        ? `Thanh toán ${g} không thành công cho đơn #${orderId}. Kiểm tra lại hoặc thử lại từ đơn hàng.`
        : `Thanh toán ${g} không thành công.`,
    }
    notice.show({
      kind: 'error',
      title: 'Thanh toán thất bại',
      message: orderId ? `Đơn #${orderId} chưa thanh toán được.` : 'Giao dịch không thành công.',
      durationMs: 3600,
    })
  }
}

function consumePayQuery() {
  let pay = String(route.query.pay ?? '').toLowerCase()
  let orderId = String(route.query.orderId ?? '')
  let gateway = String(route.query.gateway ?? 'vnpay')

  if (!pay) {
    try {
      const raw = sessionStorage.getItem(PAY_RETURN_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as {
          pay?: string
          orderId?: string
          gateway?: string
        }
        pay = String(saved.pay ?? '').toLowerCase()
        orderId = String(saved.orderId ?? '')
        gateway = String(saved.gateway ?? 'vnpay')
      }
    } catch {
      /* ignore */
    }
  }

  if (!pay) return

  try {
    sessionStorage.removeItem(PAY_RETURN_KEY)
  } catch {
    /* ignore */
  }

  applyPayStatus(pay, orderId, gateway)

  // Clean query so refresh không hiện lại banner/toast
  const nextQuery = { ...route.query } as Record<string, string | string[]>
  delete nextQuery.pay
  delete nextQuery.status
  delete nextQuery.code
  delete nextQuery.txnRef
  delete nextQuery.gateway
  delete nextQuery.orderId
  void router.replace({ path: '/cart', query: nextQuery })
}

onMounted(async () => {
  consumePayQuery()
  if (!cart.lines.length) {
    await cart.refresh({ enrichCatalog: false })
  }
  const pending = peekPendingVoucherCode()
  if (pending && cart.lines.length) {
    coupon.value = pending
    await applyCoupon()
  }
})

async function checkout() {
  checkoutLoading.value = true
  try {
    await cart.prepareForCheckout()
    await router.push('/checkout')
  } catch {
    /* error surfaced on cart store */
  } finally {
    checkoutLoading.value = false
  }
}

async function applyCoupon() {
  const code = coupon.value.trim()
  if (!code) return
  couponLoading.value = true
  couponMessage.value = ''
  couponIsError.value = false
  couponApplied.value = false
  couponDiscount.value = 0
  try {
    const res = await validateCartVoucher({
      code,
      lines: cart.lines,
      cartSubtotal: cart.total,
      singleSellerId: singleSellerId.value,
    })
    if (res.valid && res.discountAmount != null) {
      couponApplied.value = true
      couponDiscount.value = res.discountAmount
      rememberPendingVoucherCode(res.code ?? code)
      couponMessage.value = `Đã áp dụng ${res.code ?? code} — giảm ${formatVnd(res.discountAmount)}`
    } else {
      couponMessage.value = voucherUserMessage(res.message)
      couponIsError.value = true
    }
  } catch (e) {
    couponMessage.value = voucherUserMessage(e instanceof Error ? e.message : '')
    couponIsError.value = true
  } finally {
    couponLoading.value = false
  }
}
</script>

<template>
  <div class="elegant-page">
    <div class="elegant-page__inner">
      <h1 class="elegant-page-title elegant-page-title--center">Giỏ hàng</h1>
      <CheckoutStepper :step="1" />

      <div
        v-if="payBanner"
        class="elegant-alert"
        :class="{
          'elegant-alert--error': payBanner.kind === 'err',
        }"
        :style="
          payBanner.kind === 'ok'
            ? 'margin-bottom:1rem;background:#ecfdf5;border:1px solid #6ee7b7;color:#065f46'
            : payBanner.kind === 'warn'
              ? 'margin-bottom:1rem;background:#fff7ed;border:1px solid #fdba74;color:#9a3412'
              : 'margin-bottom:1rem'
        "
      >
        <p style="margin:0">{{ payBanner.text }}</p>
        <div v-if="payBanner.orderId" style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.65rem">
          <RouterLink
            class="btn-elegant-primary btn-interactive"
            :to="{ path: `/orders/${payBanner.orderId}`, query: { view: 'detail' } }"
          >            Xem đơn #{{ payBanner.orderId }}
          </RouterLink>
          <RouterLink class="btn-interactive" to="/orders">Đơn của tôi</RouterLink>
          <button type="button" class="btn-interactive" @click="payBanner = null">Đóng</button>
        </div>
      </div>

      <LoadingSpinner v-if="cart.loading" page label="Đang tải giỏ hàng" />
      <EmptyState
        v-else-if="!cart.lines.length"
        icon="🛒"
        title="Giỏ hàng trống"
        description="Khám phá sản phẩm và thêm vào giỏ nhé!"
      >
        <RouterLink to="/" class="btn-elegant-primary btn-interactive" style="margin-top: 1rem; display: inline-flex">
          Mua sắm ngay
        </RouterLink>
      </EmptyState>

      <div v-else class="elegant-cart">
        <div class="elegant-cart__main">
          <div class="elegant-cart-table">
            <div class="elegant-cart-table__head">
              <span>Sản phẩm</span>
              <span>Số lượng</span>
              <span>Đơn giá</span>
              <span>Thành tiền</span>
            </div>
            <div v-for="line in cart.lines" :key="line.product.id" class="elegant-cart-row">
              <div class="elegant-cart-row__product">
                <img :src="line.product.imageUrl" :alt="line.product.name" />
                <div>
                  <div class="elegant-cart-row__name">{{ line.product.name }}</div>
                  <div class="elegant-cart-row__meta">Loại: {{ line.product.category }}</div>
                  <button
                    type="button"
                    class="elegant-cart-row__remove btn-interactive"
                    @click="cart.remove(line.product.id)"
                  >
                    × Xóa
                  </button>
                </div>
              </div>
              <QuantityStepper
                variant="pill"
                :model-value="line.quantity"
                :min="1"
                :max="line.product.stock"
                @update:model-value="cart.setQuantity(line.product.id, $event)"
              />
              <span class="elegant-cart-row__unit">{{ formatVnd(line.product.price) }}</span>
              <strong class="elegant-cart-row__subtotal">{{ formatVnd(line.subtotal) }}</strong>
            </div>
          </div>

          <section class="elegant-coupon">
            <h2>Bạn có mã giảm giá?</h2>
            <p>Nhập mã tại đây hoặc ở bước thanh toán (gợi ý: SEDSP10, SHOP50K).</p>
            <div class="elegant-coupon__form">
              <input v-model="coupon" type="text" placeholder="Mã giảm giá" />
              <button
                type="button"
                class="btn-elegant-primary btn-interactive"
                :disabled="couponLoading"
                @click="applyCoupon"
              >
                {{ couponLoading ? 'Đang kiểm tra…' : 'Áp dụng' }}
              </button>
            </div>
            <p
              v-if="couponMessage"
              class="elegant-coupon-msg"
              :class="{ 'elegant-coupon-msg--error': couponIsError, 'elegant-coupon-msg--ok': couponApplied }"
            >
              {{ couponMessage }}
            </p>
          </section>
        </div>

        <aside class="elegant-summary">
          <h2 class="elegant-summary__title">Tóm tắt giỏ hàng</h2>

          <label class="elegant-shipping-opt" :class="{ 'elegant-shipping-opt--active': shipping === 'free' }">
            <input v-model="shipping" type="radio" value="free" name="shipping" />
            <span class="elegant-shipping-opt__label">Giao tiêu chuẩn</span>
            <span class="elegant-shipping-opt__price">
              {{ shipping === 'free' ? (shippingFee === 0 ? 'Miễn phí' : formatVnd(shippingFee)) : '' }}
            </span>
          </label>
          <label class="elegant-shipping-opt" :class="{ 'elegant-shipping-opt--active': shipping === 'express' }">
            <input v-model="shipping" type="radio" value="express" name="shipping" />
            <span class="elegant-shipping-opt__label">Giao nhanh</span>
            <span class="elegant-shipping-opt__price">+{{ formatVnd(35_000) }}</span>
          </label>
          <label class="elegant-shipping-opt" :class="{ 'elegant-shipping-opt--active': shipping === 'pickup' }">
            <input v-model="shipping" type="radio" value="pickup" name="shipping" />
            <span class="elegant-shipping-opt__label">Nhận tại cửa hàng</span>
            <span class="elegant-shipping-opt__price">Miễn phí</span>
          </label>

          <div class="elegant-summary__rows">
            <div class="elegant-summary__row">
              <span>Tạm tính</span>
              <span>{{ formatVnd(cart.total) }}</span>
            </div>
            <div v-if="discount" class="elegant-summary__row elegant-summary__row--discount">
              <span>Giảm giá</span>
              <span>-{{ formatVnd(discount) }}</span>
            </div>
            <div class="elegant-summary__row">
              <span>Phí vận chuyển</span>
              <span>{{ shippingFee === 0 ? 'Miễn phí' : formatVnd(shippingFee) }}</span>
            </div>
          </div>

          <div class="elegant-summary__total">
            <span>Tổng</span>
            <strong>{{ formatVnd(grandTotal) }}</strong>
          </div>

          <button
            type="button"
            class="btn-elegant-primary btn-block btn-interactive"
            :disabled="checkoutLoading"
            @click="checkout"
          >
            {{ checkoutLoading ? 'Đang chuẩn bị…' : 'Thanh toán' }}
          </button>
        </aside>
      </div>
    </div>

    <NewsletterBanner />
  </div>
</template>
