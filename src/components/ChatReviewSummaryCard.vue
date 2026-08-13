<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { ChatReviewSummary } from '@/types'
import { formatVnd } from '@/api/chat/match'
import {
  formatReviewStars,
  reviewConfidenceLabel,
  reviewSampleConfidence,
} from '@/api/chat/productReviewSummary'
import { useChatWidgetStore } from '@/stores/chatWidget'

const props = defineProps<{
  summary: ChatReviewSummary
}>()

const router = useRouter()
const widget = useChatWidgetStore()

const ratingLabel = computed(() =>
  props.summary.averageRating > 0 ? props.summary.averageRating.toFixed(1) : '—',
)

const confidence = computed(() => reviewSampleConfidence(props.summary.totalReviews))
const confidenceText = computed(() => reviewConfidenceLabel(confidence.value))

function openProduct() {
  widget.hide()
  void router.push(`/products/${props.summary.productId}`)
}
</script>

<template>
  <article class="chat-review-card" aria-label="Tổng hợp đánh giá sản phẩm">
    <header class="chat-review-card__head">
      <div>
        <p class="chat-review-card__eyebrow">Bằng chứng đánh giá</p>
        <h3 class="chat-review-card__title">{{ summary.productName }}</h3>
        <p v-if="confidenceText" class="chat-review-card__conf">{{ confidenceText }}</p>
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
    </div>

    <p v-else class="chat-review-card__empty">
      Chưa có đánh giá — bạn có thể là người đầu tiên review sản phẩm này.
    </p>

    <ul v-if="summary.highlights.length" class="chat-review-card__quotes">
      <li v-for="h in summary.highlights.slice(0, 2)" :key="h.id">
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
      <span v-if="summary.soldCount > 0">{{ summary.soldCount.toLocaleString('vi-VN') }} lượt mua</span>
      <span v-if="summary.origin">Xuất xứ: {{ summary.origin }}</span>
      <span v-if="summary.shopName">Shop: {{ summary.shopName }}</span>
      <span v-if="summary.price != null">{{ formatVnd(summary.price) }}</span>
    </footer>
  </article>
</template>

<style scoped>
.chat-review-card {
  margin-top: 0.55rem;
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  border: 1px solid var(--slate-200, #e2e8f0);
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.chat-review-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.chat-review-card__eyebrow {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--slate-500, #64748b);
}

.chat-review-card__title {
  margin: 0.12rem 0 0;
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--slate-900, #0f172a);
}

.chat-review-card__conf {
  margin: 0.2rem 0 0;
  font-size: 0.72rem;
  color: var(--amber-700, #b45309);
  font-style: italic;
}

.chat-review-card__link {
  flex-shrink: 0;
  border: none;
  background: var(--brand-50, #eff6ff);
  color: var(--brand-700, #1d4ed8);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.3rem 0.5rem;
  border-radius: 8px;
  cursor: pointer;
}

.chat-review-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
}

.chat-review-card__stat {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
  padding: 0.4rem 0.45rem;
  border-radius: 8px;
  background: var(--slate-50, #f8fafc);
  border: 1px solid var(--slate-100, #f1f5f9);
  font-size: 0.68rem;
  color: var(--slate-500, #64748b);
}

.chat-review-card__stat strong {
  font-size: 0.92rem;
  color: var(--slate-900, #0f172a);
}

.chat-review-card__stat--accent strong {
  color: var(--brand-700, #1d4ed8);
}

.chat-review-card__empty {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--slate-600, #475569);
}

.chat-review-card__quotes {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.chat-review-card__quotes li {
  padding: 0.45rem 0.55rem;
  border-radius: 8px;
  background: var(--slate-50, #f8fafc);
  border-left: 2px solid var(--brand-400, #60a5fa);
}

.chat-review-card__quote-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem;
  font-size: 0.78rem;
}

.chat-review-card__stars {
  color: #f59e0b;
  letter-spacing: 0.02em;
}

.chat-review-card__quote-text {
  margin: 0.2rem 0 0;
  font-size: 0.78rem;
  line-height: 1.4;
  color: var(--slate-700, #334155);
}

.chat-review-card__foot {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
  font-size: 0.72rem;
  color: var(--slate-500, #64748b);
  padding-top: 0.1rem;
  border-top: 1px dashed var(--slate-200, #e2e8f0);
}
</style>
