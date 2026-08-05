<script setup lang="ts">
/**
 * Bridge cũ: VNPay/MoMo giờ redirect thẳng /cart?pay=…
 * Giữ route này để link cũ /payment/result vẫn đưa về giỏ + thông báo.
 */
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

onMounted(() => {
  const status = String(route.query.status ?? route.query.pay ?? 'failed')
  const pay =
    status === 'success' ? 'success' : status === 'cancelled' || status === 'pending' ? 'cancelled' : 'failed'

  void router.replace({
    path: '/cart',
    query: {
      pay,
      gateway: String(route.query.gateway ?? 'vnpay'),
      orderId: String(route.query.orderId ?? ''),
      code: String(route.query.code ?? ''),
      txnRef: String(route.query.txnRef ?? ''),
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
