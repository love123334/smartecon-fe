<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { formatVnd, orderApi, productApi, sellerMomoApi, voucherApi } from '@/api/services'
import type { SellerMomoPublic } from '@/api/real/sellerMomo'
import type { ValidateVoucherResult } from '@/api/real/vouchers'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { trySiteFx } from '@/utils/siteFx'
import QuantityStepper from '@/components/QuantityStepper.vue'
import CheckoutStepper from '@/components/CheckoutStepper.vue'
import NewsletterBanner from '@/components/NewsletterBanner.vue'

type CheckoutPayment = 'momo_qr'

const auth = useAuthStore()
const cart = useCartStore()
const router = useRouter()

const firstName = ref('')
const lastName = ref('')
const phone = ref('')
const email = ref('')
const address = ref('')
const city = ref('')
const state = ref('')
const zip = ref('')
const payment = ref<CheckoutPayment>('momo_qr')
const coupon = ref('')
const couponApplied = ref(false)
const couponInfo = ref<ValidateVoucherResult | null>(null)
const couponMessage = ref('')
const couponLoading = ref(false)
const error = ref('')
const loading = ref(false)
const sellerMomo = ref<SellerMomoPublic | null>(null)
const sellerMomoLoading = ref(false)

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

const canUseMomoQr = computed(() => {
  if (!sellerMomo.value?.configured) return false
  if (cartSellerIds.value.length > 1) return false
  return cart.lines.length > 0
})

const shippingFee = computed(() => (cart.total >= 500_000 ? 0 : 30_000))
const discount = computed(() => (couponApplied.value ? couponInfo.value?.discountAmount ?? 0 : 0))
const grandTotal = computed(() => Math.max(0, cart.total + shippingFee.value - discount.value))

const checkoutBlockedReason = computed(() => {
  if (cart.lines.length === 0) return ''
  if (cartSellerIds.value.length > 1) {
    return 'Chỉ thanh toán MoMo shop khi giỏ hàng có sản phẩm từ một shop duy nhất.'
  }
  if (sellerMomoLoading.value) return ''
  if (!sellerMomo.value?.configured) {
    return 'Shop chưa cấu hình MoMo (SĐT hoặc QR). Vui lòng liên hệ người bán.'
  }
  return ''
})

async function loadSellerMomoPreview() {
  sellerMomo.value = null
  let sid = singleSellerId.value
  if ((!sid || !/^\d+$/.test(sid)) && cart.lines.length) {
    for (const line of cart.lines) {
      if (line.product.sellerId && /^\d+$/.test(line.product.sellerId)) {
        sid = line.product.sellerId
        break
      }
      try {
        const p = await productApi.getById(line.product.id, { withStock: false })
        if (p?.sellerId && /^\d+$/.test(p.sellerId)) {
          sid = p.sellerId
          break
        }
      } catch {
        /* try next line */
      }
    }
  }
  if (!sid || !/^\d+$/.test(sid)) return
  sellerMomoLoading.value = true
  try {
    sellerMomo.value = await sellerMomoApi.getPublic(sid)
  } catch {
    sellerMomo.value = null
  } finally {
    sellerMomoLoading.value = false
  }
}

onMounted(async () => {
  if (cart.dirty) {
    await cart.prepareForCheckout()
  } else if (!cart.lines.length) {
    await cart.refresh({ enrichCatalog: true })
  }
  await loadSellerMomoPreview()
  if (auth.user) {
    const parts = (auth.user.fullName ?? '').trim().split(/\s+/)
    lastName.value = parts.pop() ?? ''
    firstName.value = parts.join(' ')
    address.value = auth.user.address ?? ''
    phone.value = auth.user.phone ?? ''
    email.value = auth.user.email ?? ''
  }
})

watch(singleSellerId, () => {
  if (loading.value) return
  void loadSellerMomoPreview()
})

async function applyCoupon() {
  if (trySiteFx(coupon.value)) {
    coupon.value = ''
    return
  }
  const code = coupon.value.trim()
  if (!code) return
  couponLoading.value = true
  couponMessage.value = ''
  couponApplied.value = false
  couponInfo.value = null
  try {
    const productIds = cart.lines.flatMap((l) => Array.from({ length: l.quantity }, () => Number(l.product.id)))
    const res = await voucherApi.validate(code, productIds)
    if (res.valid) {
      couponApplied.value = true
      couponInfo.value = res
      couponMessage.value = res.message || `Áp dụng ${res.code} — giảm ${formatVnd(res.discountAmount ?? 0)}`
    } else {
      couponMessage.value = res.message || 'Mã không hợp lệ.'
    }
  } catch (e) {
    couponMessage.value = e instanceof Error ? e.message : 'Không kiểm tra được mã.'
  } finally {
    couponLoading.value = false
  }
}

async function placeOrder() {
  if (!auth.user) return
  if (!address.value.trim()) {
    error.value = 'Vui lòng nhập địa chỉ giao hàng'
    return
  }
  if (!canUseMomoQr.value) {
    error.value = checkoutBlockedReason.value || 'Không thể thanh toán MoMo shop lúc này.'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const fullAddress = [address.value, city.value, state.value, zip.value].filter(Boolean).join(', ')
    const order = await orderApi.placeOrder(
      auth.user.id,
      fullAddress || address.value,
      payment.value,
      couponApplied.value ? coupon.value.trim() : undefined,
    )
    await cart.refresh()
    await router.push({ path: `/orders/${order.id}/pay-momo`, query: { placed: '1' } })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Đặt hàng thất bại'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="elegant-page">
    <div class="elegant-page__inner">
      <h1 class="elegant-page-title elegant-page-title--center">Thanh toán</h1>
      <CheckoutStepper :step="2" />

      <p v-if="!cart.lines.length" class="empty">
        Giỏ hàng trống. <RouterLink to="/">Tiếp tục mua</RouterLink>
      </p>

      <div v-if="cart.lines.length" class="elegant-checkout">
        <div class="elegant-checkout__forms">
          <p v-if="error" class="elegant-alert elegant-alert--error">{{ error }}</p>

          <section class="elegant-form-section">
            <h2>Thông tin liên hệ</h2>
            <div class="elegant-form-grid elegant-form-grid--2">
              <div class="elegant-field">
                <label for="firstName">Họ</label>
                <input id="firstName" v-model="firstName" type="text" placeholder="Nguyễn" />
              </div>
              <div class="elegant-field">
                <label for="lastName">Tên</label>
                <input id="lastName" v-model="lastName" type="text" placeholder="Văn A" />
              </div>
              <div class="elegant-field">
                <label for="phone">Số điện thoại</label>
                <input id="phone" v-model="phone" type="tel" placeholder="0901234567" />
              </div>
              <div class="elegant-field">
                <label for="email">Email</label>
                <input id="email" v-model="email" type="email" placeholder="email@example.com" />
              </div>
            </div>
          </section>

          <section class="elegant-form-section">
            <h2>Địa chỉ giao hàng</h2>
            <div class="elegant-form-grid">
              <div class="elegant-field">
                <label for="addr">Địa chỉ</label>
                <input id="addr" v-model="address" type="text" placeholder="Số nhà, đường, phường..." required />
              </div>
              <div class="elegant-form-grid elegant-form-grid--3">
                <div class="elegant-field">
                  <label for="city">Thành phố</label>
                  <input id="city" v-model="city" type="text" placeholder="TP.HCM" />
                </div>
                <div class="elegant-field">
                  <label for="state">Quận/Huyện</label>
                  <input id="state" v-model="state" type="text" placeholder="Quận 1" />
                </div>
                <div class="elegant-field">
                  <label for="zip">Mã bưu điện</label>
                  <input id="zip" v-model="zip" type="text" placeholder="700000" />
                </div>
              </div>
            </div>
          </section>

          <section class="elegant-form-section">
            <h2>Phương thức thanh toán</h2>
            <p class="elegant-muted" style="margin-bottom: 0.75rem; font-size: 0.9rem">
              Chuyển MoMo trực tiếp tới shop
              <template v-if="sellerMomo?.storeName"> <strong>{{ sellerMomo.storeName }}</strong></template>.
              Shop xác nhận khi đã nhận đủ tiền.
            </p>
            <div class="elegant-payment elegant-payment--momo elegant-payment--active">
              <span>
                Chuyển MoMo tới shop
                <template v-if="sellerMomo?.storeName"> ({{ sellerMomo.storeName }})</template>
              </span>
            </div>
            <p v-if="checkoutBlockedReason" class="elegant-alert elegant-alert--error" style="margin-top: 0.75rem">
              {{ checkoutBlockedReason }}
            </p>
            <p v-else-if="sellerMomoLoading" class="elegant-muted" style="font-size: 0.85rem; margin: 0.35rem 0">
              Đang kiểm tra MoMo shop…
            </p>
          </section>

          <button
            type="button"
            class="btn-elegant-primary btn-block btn-interactive elegant-checkout__submit"
            :disabled="loading || !canUseMomoQr || Boolean(checkoutBlockedReason)"
            @click="placeOrder"
          >
            {{
              loading
                ? 'Đang tạo đơn…'
                : 'Đặt hàng & xem hướng dẫn MoMo'
            }}
          </button>
        </div>

        <aside class="elegant-order-summary">
          <h2 class="elegant-summary__title">Tóm tắt đơn hàng</h2>

          <ul class="elegant-order-items">
            <li v-for="line in cart.lines" :key="line.product.id" class="elegant-order-item">
              <img :src="line.product.imageUrl" :alt="line.product.name" loading="lazy" />
              <div class="elegant-order-item__info">
                <div class="elegant-order-item__name">{{ line.product.name }}</div>
                <div class="elegant-order-item__meta">{{ line.product.category }}</div>
                <QuantityStepper
                  variant="pill"
                  :model-value="line.quantity"
                  :min="1"
                  :max="line.product.stock"
                  @update:model-value="cart.setQuantity(line.product.id, $event)"
                />
              </div>
              <strong>{{ formatVnd(line.subtotal) }}</strong>
            </li>
          </ul>

          <div class="elegant-coupon__form elegant-coupon__form--compact">
            <input
              v-model="coupon"
              type="text"
              placeholder="Mã giảm giá (vd. SEDSP10)"
              @keyup.enter="applyCoupon"
            />
            <button
              type="button"
              class="btn-elegant-primary btn-interactive"
              :disabled="couponLoading"
              @click="applyCoupon"
            >
              {{ couponLoading ? 'Đang kiểm tra…' : 'Áp dụng' }}
            </button>
          </div>
          <p class="elegant-muted" style="font-size: 0.8rem; margin: 0.35rem 0 0">
            Mã demo: <strong>SEDSP10</strong> (toàn sàn) · <strong>SHOP50K</strong> (theo shop)
          </p>
          <p v-if="couponMessage" class="muted" style="margin-top: 0.35rem">{{ couponMessage }}</p>
          <p v-if="couponApplied" class="elegant-coupon-applied">
            {{ couponInfo?.code || coupon }}
            <span>-{{ formatVnd(discount) }}</span>
            <button
              type="button"
              class="btn-interactive"
              @click="
                couponApplied = false;
                couponInfo = null;
                couponMessage = '';
              "
            >
              [Xóa]
            </button>
          </p>

          <div class="elegant-summary__rows">
            <div class="elegant-summary__row">
              <span>Vận chuyển</span>
              <span>{{ shippingFee === 0 ? 'Miễn phí' : formatVnd(shippingFee) }}</span>
            </div>
            <div class="elegant-summary__row">
              <span>Tạm tính</span>
              <span>{{ formatVnd(cart.total) }}</span>
            </div>
            <div v-if="discount" class="elegant-summary__row elegant-summary__row--discount">
              <span>Giảm giá</span>
              <span>-{{ formatVnd(discount) }}</span>
            </div>
          </div>

          <div class="elegant-summary__total">
            <span>Tổng</span>
            <strong>{{ formatVnd(grandTotal) }}</strong>
          </div>
        </aside>
      </div>
    </div>

    <NewsletterBanner />
  </div>
</template>
