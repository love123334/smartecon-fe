<script setup lang="ts">
/**
 * Public bridge after VNPay/MoMo return.
 * Redirects to order detail (success/cancel) or cart (failed).
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
  const orderId = String(route.query.orderId ?? '')
  const pay =
    status === 'success'
      ? 'success'
      : status === 'cancelled' || status === '24'
        ? 'cancelled'
        : 'failed'

  const payload = {
    pay,
    gateway: String(route.query.gateway ?? 'vnpay'),
    orderId,
    code: String(route.query.code ?? ''),
    txnRef: String(route.query.txnRef ?? ''),
  }

  try {
    sessionStorage.setItem(PAY_RETURN_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }

  if (!auth.isLoggedIn) {
    const redirect = orderId ? `/orders/${orderId}?view=detail` : '/cart'
    void router.replace({
      name: 'login',
      query: { redirect },
    })
    return
  }

  if (orderId) {
    void router.replace({
      path: `/orders/${orderId}`,
      query: { view: 'detail', pay },
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
      <p class="empty">Đang chuyển hướng…</p>
    </div>
  </div>
</template>
