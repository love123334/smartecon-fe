<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatVnd, voucherApi } from '@/api/services'
import type { Voucher } from '@/api/real/vouchers'
import { useAuthStore } from '@/stores/auth'
import { useNoticeStore } from '@/stores/notice'
import { canShopAsBuyer } from '@/utils/roleNav'
import { demoPublicVouchers, rememberPendingVoucherCode } from '@/utils/voucherCheckout'

const props = defineProps<{
  sellerId?: number | string | null
  compact?: boolean
}>()

const router = useRouter()
const auth = useAuthStore()
const notice = useNoticeStore()
const vouchers = ref<Voucher[]>([])
const loading = ref(true)
const copiedCode = ref('')

const visible = computed(() => vouchers.value.slice(0, props.compact ? 3 : 4))

onMounted(async () => {
  try {
    const sid = props.sellerId != null ? Number(props.sellerId) : undefined
    const list = await voucherApi.listPublic(Number.isFinite(sid) ? sid : undefined)
    vouchers.value = list.length ? list : demoPublicVouchers()
  } catch {
    vouchers.value = demoPublicVouchers()
  } finally {
    loading.value = false
  }
})

function label(v: Voucher) {
  return v.discountType === 'PERCENTAGE'
    ? `Giảm ${v.discountValue}%`
    : `Giảm ${formatVnd(v.discountValue)}`
}

function minLabel(v: Voucher) {
  return v.minimumOrderAmount > 0 ? `Đơn từ ${formatVnd(v.minimumOrderAmount)}` : 'Không tối thiểu'
}

async function saveCode(v: Voucher) {
  rememberPendingVoucherCode(v.code)
  copiedCode.value = v.code
  try {
    await navigator.clipboard.writeText(v.code)
  } catch {
    /* clipboard may be blocked */
  }
  notice.show({
    kind: 'info',
    title: `Đã lưu mã ${v.code}`,
    message: 'Mã sẽ được điền sẵn khi bạn thanh toán.',
    durationMs: 2800,
  })
}

async function useAtCheckout(v: Voucher) {
  await saveCode(v)
  if (!auth.isLoggedIn || !canShopAsBuyer(auth.role)) {
    await router.push({ name: 'login', query: { redirect: '/checkout' } })
    return
  }
  await router.push('/checkout')
}
</script>

<template>
  <aside v-if="!loading && visible.length" class="voucher-banner" aria-label="Mã khuyến mãi">
    <div class="voucher-banner__head">
      <strong>Mã giảm giá đang áp dụng</strong>
      <p class="voucher-banner__hint">
        Chọn mã để lưu — hệ thống điền sẵn lúc thanh toán. Giá sản phẩm không giảm sẵn trên trang chi tiết.
      </p>
    </div>
    <ul>
      <li v-for="v in visible" :key="v.id">
        <div class="voucher-banner__meta">
          <code>{{ v.code }}</code>
          <span>{{ label(v) }} · {{ v.scope === 'SHOP' ? (v.sellerName || 'theo shop') : 'toàn sàn' }} · {{ minLabel(v) }}</span>
          <small v-if="v.description || v.name">{{ v.description || v.name }}</small>
        </div>
        <div class="voucher-banner__actions">
          <button type="button" class="voucher-banner__btn" @click="saveCode(v)">
            {{ copiedCode === v.code ? 'Đã lưu' : 'Lưu mã' }}
          </button>
          <button type="button" class="voucher-banner__btn voucher-banner__btn--primary" @click="useAtCheckout(v)">
            Dùng khi thanh toán
          </button>
        </div>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.voucher-banner {
  margin: 0 0 1rem;
  padding: 0.95rem 1.05rem;
  border-radius: 12px;
  background: linear-gradient(90deg, #ecfdf5, #eff6ff);
  border: 1px solid #a7f3d0;
  font-size: 0.92rem;
}
.voucher-banner__head strong {
  display: block;
  color: #0f766e;
}
.voucher-banner ul {
  list-style: none;
  margin: 0.7rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.55rem;
}
.voucher-banner li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.8rem;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #d1fae5;
}
.voucher-banner__meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}
.voucher-banner__meta span,
.voucher-banner__meta small {
  color: #64748b;
  font-size: 0.8rem;
}
.voucher-banner__hint {
  margin: 0.3rem 0 0;
  color: #64748b;
  font-size: 0.82rem;
}
.voucher-banner__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  flex-shrink: 0;
}
.voucher-banner__btn {
  border: 1px solid #99f6e4;
  background: #fff;
  color: #0f766e;
  border-radius: 8px;
  padding: 0.35rem 0.65rem;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}
.voucher-banner__btn--primary {
  background: #0f766e;
  color: #fff;
  border-color: #0f766e;
}
code {
  font-weight: 800;
  color: #0f766e;
  letter-spacing: 0.04em;
}
@media (max-width: 720px) {
  .voucher-banner li {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
