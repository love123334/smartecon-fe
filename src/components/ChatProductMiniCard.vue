<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { ChatProductRef } from '@/types'
import { formatVnd } from '@/api/chat/match'
import { handleProductImageError, repairProductImageUrl } from '@/utils/productImage'
import { useChatWidgetStore } from '@/stores/chatWidget'

const props = defineProps<{
  product: ChatProductRef
  compact?: boolean
}>()

const router = useRouter()
const widget = useChatWidgetStore()

const displaySrc = computed(() =>
  repairProductImageUrl(props.product.imageUrl, {
    seed: props.product.id,
    category: props.product.category,
  }),
)

function onImgError(e: Event) {
  handleProductImageError(e, [displaySrc.value])
}

function openProduct() {
  widget.hide()
  void router.push(`/products/${props.product.id}`)
}
</script>

<template>
  <button type="button" class="chat-mini-card" :title="product.name" @click="openProduct">
    <div class="chat-mini-card__media">
      <img
        :src="displaySrc"
        :alt="product.name"
        loading="lazy"
        decoding="async"
        @error="onImgError"
      />
    </div>
    <div class="chat-mini-card__body">
      <p class="chat-mini-card__name">{{ product.name }}</p>
      <p class="chat-mini-card__price" :title="formatVnd(product.price)">{{ formatVnd(product.price) }}</p>
      <p v-if="product.category || product.shopName" class="chat-mini-card__meta">
        <span v-if="product.category">{{ product.category }}</span>
        <span v-if="product.shopName"> · {{ product.shopName }}</span>
      </p>
    </div>
  </button>
</template>

<style scoped>
.chat-mini-card {
  display: flex;
  gap: 0.65rem;
  min-width: 0;
  max-width: 100%;
  width: 100%;
  padding: 0.55rem;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  color: inherit;
  overflow: hidden;
  box-sizing: border-box;
  text-align: left;
  font: inherit;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.chat-mini-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 6px 18px rgba(59, 130, 246, 0.12);
  transform: translateY(-2px);
}

.chat-mini-card__media {
  flex: 0 0 56px;
  width: 56px;
  height: 56px;
  border-radius: 10px;
  overflow: hidden;
  background: #f1f5f9;
  border: 1px solid #f8fafc;
}

.chat-mini-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.chat-mini-card__body {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.15rem;
}

.chat-mini-card__name {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 650;
  color: #1e293b;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.chat-mini-card__price {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 750;
  color: #2563eb;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.chat-mini-card__meta,
.chat-mini-card__stock {
  margin: 0;
  font-size: 0.6875rem;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-mini-card__stock[data-out='1'] {
  color: #dc2626;
  font-weight: 600;
}
</style>
