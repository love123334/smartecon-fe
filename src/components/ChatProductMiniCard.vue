<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { ChatProductRef } from '@/types'
import { formatVnd } from '@/api/chat/match'

const props = defineProps<{
  product: ChatProductRef
  compact?: boolean
}>()

const imgBroken = ref(false)

function onImgError() {
  imgBroken.value = true
}

const stockLabel = computed(() => {
  const s = props.product.stock
  if (s == null || Number.isNaN(Number(s))) return null
  // stock=0 từ list API là giả — chỉ báo hết hàng khi đã xác nhận inventory
  if (s <= 0) return props.product.stockKnown ? 'Hết hàng' : null
  return `Còn ${s}`
})

const stockOut = computed(() => {
  const s = props.product.stock
  return Boolean(props.product.stockKnown && s != null && s <= 0)
})
</script>

<template>
  <RouterLink :to="`/products/${product.id}`" class="chat-mini-card" :title="product.name">
    <div class="chat-mini-card__media">
      <img
        v-if="!imgBroken"
        :src="product.imageUrl || '/placeholder-product.png'"
        :alt="product.name"
        loading="lazy"
        decoding="async"
        @error="onImgError"
      />
      <div v-else class="chat-mini-card__fallback" aria-hidden="true">SP</div>
    </div>
    <div class="chat-mini-card__body">
      <p class="chat-mini-card__name">{{ product.name }}</p>
      <p class="chat-mini-card__price" :title="formatVnd(product.price)">{{ formatVnd(product.price) }}</p>
      <p v-if="product.category || product.shopName" class="chat-mini-card__meta">
        <span v-if="product.category">{{ product.category }}</span>
        <span v-if="product.shopName"> · {{ product.shopName }}</span>
      </p>
      <p
        v-if="stockLabel"
        class="chat-mini-card__stock"
        :data-out="stockOut ? '1' : '0'"
      >
        {{ stockLabel }}
      </p>
    </div>
  </RouterLink>
</template>

<style scoped>
.chat-mini-card {
  display: flex;
  gap: 0.55rem;
  min-width: 0;
  max-width: 100%;
  padding: 0.45rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fff;
  text-decoration: none;
  color: inherit;
  overflow: hidden;
  box-sizing: border-box;
  transition: border-color var(--transition), box-shadow var(--transition), transform var(--transition);
}

.chat-mini-card:hover {
  border-color: var(--primary-500);
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
  text-decoration: none;
  color: inherit;
}

.chat-mini-card__media {
  flex: 0 0 52px;
  width: 52px;
  height: 52px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--slate-100);
}

.chat-mini-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.chat-mini-card__fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--slate-500);
  background: var(--slate-100);
}

.chat-mini-card__body {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.chat-mini-card__name {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 650;
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.chat-mini-card__price {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 750;
  color: var(--slate-900);
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.chat-mini-card__meta,
.chat-mini-card__stock {
  margin: 0;
  font-size: 0.65rem;
  color: var(--slate-500);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.chat-mini-card__stock[data-out='1'] {
  color: #b91c1c;
}
</style>
