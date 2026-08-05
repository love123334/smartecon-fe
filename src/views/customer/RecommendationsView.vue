<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { dssApi, productApi, formatVnd } from '@/api/services'
import type { Product, Recommendation } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import PageHeader from '@/components/PageHeader.vue'
import ProductCard from '@/components/ProductCard.vue'
import AiShortcutBar from '@/components/AiShortcutBar.vue'

const auth = useAuthStore()
const cart = useCartStore()
const recs = ref<Recommendation[]>([])
const products = ref<Product[]>([])
const loading = ref(true)
const addedId = ref<string | null>(null)

const pairs = computed(() =>
  recs.value
    .map((r) => {
      const product = products.value.find((p) => p.id === r.productId)
      return product ? { rec: r, product } : null
    })
    .filter((x): x is { rec: Recommendation; product: Product } => x != null),
)

onMounted(async () => {
  if (!auth.user) return
  loading.value = true
  try {
    const [list, all] = await Promise.all([
      dssApi.recommendations(auth.user.id),
      productApi.list({ size: 80 }),
    ])
    recs.value = list
    products.value = all
  } finally {
    loading.value = false
  }
})

async function addToCart(productId: string) {
  try {
    await cart.add(productId)
    addedId.value = productId
    setTimeout(() => {
      addedId.value = null
    }, 1500)
  } catch {
    /* cart store shows error */
  }
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="AI · DSS"
      title="Gợi ý cho bạn"
      lead="Xếp hạng đa tiêu chí từ lịch sử mua, danh mục ưa thích, rating, độ phổ biến và tầm giá — kèm lý do rõ ràng."
    />
    <AiShortcutBar
      title="Tiếp theo:"
      :links="[
        { to: '/chatbot', label: 'Chatbot tư vấn', highlight: true },
        { to: '/search', label: 'Cửa hàng' },
        { to: '/orders', label: 'Đơn hàng' },
      ]"
    />

    <p v-if="loading" class="muted">Đang phân tích sở thích của bạn...</p>

    <div v-else-if="pairs.length" class="rec-grid">
      <article v-for="{ rec, product } in pairs" :key="product.id" class="rec-card card">
        <div class="rec-card__score">
          <span class="rec-card__pct">{{ Math.round(rec.score * 100) }}</span>
          <span class="rec-card__match">/ 100</span>
        </div>
        <ProductCard :product="product" compact />
        <div class="rec-card__why">
          <p class="rec-card__why-title">Vì sao gợi ý?</p>
          <ul class="rec-card__reasons">
            <li v-for="(why, i) in rec.reasons?.length ? rec.reasons : [rec.reason]" :key="i">
              ✓ {{ why }}
            </li>
          </ul>
          <div v-if="rec.breakdown?.length" class="rec-card__break">
            <span v-for="b in rec.breakdown.filter((x) => x.points > 0)" :key="b.label">
              {{ b.label }} {{ b.points }}
            </span>
          </div>
        </div>
        <div class="rec-card__foot">
          <strong>{{ formatVnd(product.price) }}</strong>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            @click="addToCart(product.id)"
          >
            {{ addedId === product.id ? 'Đã thêm ✓' : 'Thêm giỏ' }}
          </button>
        </div>
      </article>
    </div>

    <div v-else class="empty card" style="padding: 2rem; text-align: center">
      <p>Chưa đủ dữ liệu để gợi ý — mua vài món hoặc duyệt cửa hàng để DSS học sở thích.</p>
      <RouterLink to="/search" class="btn btn-primary" style="margin-top: 1rem">
        Khám phá cửa hàng
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.rec-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

.rec-card {
  position: relative;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.rec-card__score {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 2;
  text-align: center;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: var(--radius);
  padding: 0.25rem 0.5rem;
  line-height: 1.1;
}

.rec-card__pct {
  display: block;
  font-size: 0.9375rem;
  font-weight: 800;
  color: #065f46;
}

.rec-card__match {
  font-size: 0.625rem;
  letter-spacing: 0.04em;
  color: #0f766e;
}

.rec-card__why {
  margin: 0;
  padding: 0.65rem 0.75rem;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.rec-card__why-title {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #0f172a;
}

.rec-card__reasons {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.8125rem;
  color: #475569;
  line-height: 1.45;
}

.rec-card__reasons li + li {
  margin-top: 0.2rem;
}

.rec-card__break {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.5rem;
}

.rec-card__break span {
  font-size: 0.6875rem;
  padding: 0.15rem 0.4rem;
  border-radius: 999px;
  background: #e2e8f0;
  color: #334155;
}

.rec-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: auto;
}
</style>
