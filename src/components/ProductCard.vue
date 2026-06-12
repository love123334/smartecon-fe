<script setup lang="ts">
import type { Product } from '@/types'
import { formatVnd, formatSoldCount, getDiscountPercent } from '@/api/services'

defineProps<{
  product: Product
  showAdd?: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  add: [id: string]
}>()
</script>

<template>
  <article
    class="card product-card product-card--mkt product-card--glow card--glow"
    :class="{ 'product-card--compact': compact }"
  >
    <div class="product-card__media">
      <img :src="product.imageUrl" :alt="product.name" loading="lazy" />
      <span v-if="product.isFlashSale" class="product-card__flash">Flash Sale</span>
      <span v-if="getDiscountPercent(product) > 0" class="product-card__discount">
        -{{ getDiscountPercent(product) }}%
      </span>
    </div>
    <div class="body">
      <h3>
        <RouterLink :to="`/products/${product.id}`">{{ product.name }}</RouterLink>
      </h3>
      <div class="price-row">
        <p class="price">{{ formatVnd(product.price) }}</p>
        <span v-if="product.originalPrice && product.originalPrice > product.price" class="price-original">
          {{ formatVnd(product.originalPrice) }}
        </span>
      </div>
      <p class="meta">
        <span class="rating-stars">★ {{ product.rating }}</span>
        · Đã bán {{ formatSoldCount(product.soldCount) }}
      </p>
      <div v-if="showAdd || $slots.actions" class="product-card__actions">
        <slot name="actions">
          <button
            v-if="showAdd"
            type="button"
            class="btn btn-primary btn-sm btn-block"
            @click="emit('add', product.id)"
          >
            Thêm vào giỏ
          </button>
        </slot>
      </div>
    </div>
  </article>
</template>
