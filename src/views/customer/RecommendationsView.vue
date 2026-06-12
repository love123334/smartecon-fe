<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { dssApi, productApi, formatVnd } from '@/api/services'
import type { Product, Recommendation } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'

const auth = useAuthStore()
const cart = useCartStore()
const recs = ref<Recommendation[]>([])
const products = ref<Product[]>([])

onMounted(async () => {
  if (!auth.user) return
  recs.value = await dssApi.recommendations(auth.user.id)
  const all = await productApi.list()
  products.value = recs.value
    .map((r) => all.find((p) => p.id === r.productId))
    .filter((p): p is Product => p != null)
})
</script>

<template>
  <div>
    <h1 class="page-title">Gợi ý cho bạn</h1>
    <p class="hint">Dựa trên lịch sử mua hàng và hành vi tương tự (mock DSS)</p>
    <div v-if="products.length" class="grid grid-3">
      <article v-for="(p, i) in products" :key="p.id" class="card product-card">
        <img :src="p.imageUrl" :alt="p.name" />
        <div class="body">
          <h3>{{ p.name }}</h3>
          <p class="reason">{{ recs[i]?.reason }}</p>
          <p class="score">Độ phù hợp: {{ Math.round((recs[i]?.score ?? 0) * 100) }}%</p>
          <p class="price">{{ formatVnd(p.price) }}</p>
          <button type="button" class="btn btn-primary btn-sm" @click="cart.add(p.id)">
            Thêm giỏ
          </button>
        </div>
      </article>
    </div>
    <p v-else class="empty">Chưa có gợi ý</p>
  </div>
</template>

<style scoped>
.hint {
  margin-bottom: 1rem;
  color: #0f766e;
}
.reason,
.score {
  font-size: 0.85rem;
  margin: 0.25rem 0;
}
</style>
