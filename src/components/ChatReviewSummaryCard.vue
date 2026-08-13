<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { ChatReviewSummary } from '@/types'
import { formatVnd } from '@/api/chat/match'
import { formatReviewStars } from '@/api/chat/productReviewSummary'
import { useChatWidgetStore } from '@/stores/chatWidget'

const props = defineProps<{
  summary: ChatReviewSummary
}>()

const router = useRouter()
const widget = useChatWidgetStore()

const ratingLabel = computed(() =>
  props.summary.averageRating > 0 ? props.summary.averageRating.toFixed(1) : '—',
)

function openProduct() {
  widget.hide()
  void router.push(`/products/${props.summary.productId}`)
}
</script>

<template>
  <article class="chat-review-card" aria-label="Tổng hợp đánh giá sản phẩm">
    <header class="chat-review-card__head">
      <div>
        <p class="chat-review-card__eyebrow">Đánh giá khách hàng</p>
        <h3 class="chat-review-card__title">{{ summary.productName }}</h3>
      </div>
      <button type="button" class="chat-review-card__link" @click="openProduct">
        Xem SP
      </button>
    </header>

    <div v-if="summary.hasReviews" class="chat-review-card__stats">
      <div class="chat-review-card__stat chat-review-card__stat--accent">
        <span>Trung bình</span>
        <strong>{{ ratingLabel }}★</strong>
      </div>
      <div class="chat-review-card__stat">
        <span>Lượt đánh giá</span>
        <strong>{{ summary.totalReviews }}</strong>
      </div>
      <div v-if="summary.soldCount > 0" class="chat-review-card__stat">
        <span>Đã mua</span>
        <strong>{{ summary.soldCount }}</strong>
      </div>
    </div>

    <p v-else class="chat-review-card__empty">
      Chưa có đánh giá — bạn có thể là người đầu tiên review sản phẩm này.
    </p>

    <p v-if="summary.purchaseInsight" class="chat-review-card__insight">
      {{ summary.purchaseInsight }}
    </p>

    <ul v-if="summary.highlights.length" class="chat-review-card__quotes">
      <li v-for="h in summary.highlights" :key="h.id">
        <div class="chat-review-card__quote-head">
          <strong>{{ h.userName }}</strong>
          <span class="chat-review-card__stars" :aria-label="`${h.rating} sao`">{{
            formatReviewStars(h.rating)
          }}</span>
        </div>
        <p class="chat-review-card__quote-text">"{{ h.comment }}"</p>
      </li>
    </ul>

    <footer class="chat-review-card__foot">
      <span v-if="summary.origin">Xuất xứ: {{ summary.origin }}</span>
      <span v-if="summary.shopName">Shop: {{ summary.shopName }}</span>
      <span v-if="summary.price != null">{{ formatVnd(summary.price) }}</span>
    </footer>
  </article>
</template>

<style scoped>
.chat-review-card {
  margin-top: 0.65rem;
  padding: 0.75rem 0.85rem;
  border-radius: 12px;
  border: 1px solid var(--slate-200, #e2e8f0);
  background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.chat-review-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.chat-review-card__eyebrow {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--slate-500, #64748b);
}

.chat-review-card__title {
  margin: 0.15rem 0 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--slate-900, #0f172a);
}

.chat-review-card__link {
  flex-shrink: 0;
  border: none;
  background: var(--brand-50, #eff6ff);
  color: var(--brand-700, #1d4ed8);
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.35rem 0.55rem;
  border-radius: 8px;
  cursor: pointer;
}

.chat-review-card__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
}

.chat-review-card__stat {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.45rem 0.5rem;
  border-radius: 8px;
  background: #fff;
  border: 1px solid var(--slate-100, #f1f5f9);
  font-size: 0.72rem;
  color: var(--slate-500, #64748b);
}

.chat-review-card__stat strong {
  font-size: 1rem;
  color: var(--slate-900, #0f172a);
}

.chat-review-card__stat--accent strong {
  color: var(--brand-700, #1d4ed8);
}

.chat-review-card__empty,
.chat-review-card__insight {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--slate-600, #475569);
}

.chat-review-card__quotes {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.chat-review-card__quotes li {
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  background: #fff;
  border-left: 3px solid var(--brand-400, #60a5fa);
}

.chat-review-card__quote-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem;
  font-size: 0.82rem;
}

.chat-review-card__stars {
  color: #f59e0b;
  letter-spacing: 0.02em;
}

.chat-review-card__quote-text {
  margin: 0.25rem 0 0;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--slate-700, #334155);
}

.chat-review-card__foot {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
  font-size: 0.75rem;
  color: var(--slate-500, #64748b);
  padding-top: 0.15rem;
  border-top: 1px dashed var(--slate-200, #e2e8f0);
}
</style>
