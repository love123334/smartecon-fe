<script setup lang="ts">
/**
 * Public bridge after VNPay/MoMo return.
 * Saves pay status then routes to /cart (or login → cart) so cancel never “kicks” users away.
 */
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const PAY_RETURN_KEY = 'sedsp_pay_return'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

onMounted(async () => {
  if (!auth.user && !auth.loading) {
    await auth.hydrate()
  }

  const status = String(route.query.status ?? route.query.pay ?? 'failed').toLowerCase()
  const pay =
    status === 'success'
      ? 'success'
      : status === 'cancelled' || status === 'pending' || status === '24'
        ? 'cancelled'
        : 'failed'

  const payload = {
    pay,
    gateway: String(route.query.gateway ?? 'vnpay'),
    orderId: String(route.query.orderId ?? ''),
    code: String(route.query.code ?? ''),
    txnRef: String(route.query.txnRef ?? ''),
  }

  try {
    sessionStorage.setItem(PAY_RETURN_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }

  if (!auth.isLoggedIn) {
    // Keep user in-flow: login then back to cart (banner restored from sessionStorage)
    void router.replace({
      name: 'login',
      query: { redirect: '/cart' },
    })
    return
  }

  void router.replace({
    path: '/cart',
    query: {
      pay: payload.pay,
      gateway: payload.gateway,
      orderId: payload.orderId,
      code: payload.code,
      txnRef: payload.txnRef,
    },
  })
})
</script>

<template>
  <div class="elegant-page">
    <div class="container elegant-page__inner" style="max-width: 480px">
      <p class="empty">Đang chuyển về giỏ hàng…</p>
    </div>
  </div>
</template>
