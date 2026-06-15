<script setup lang="ts">
import { computed } from 'vue'
import type { Product } from '@/types'
import { formatVnd, getDiscountPercent } from '@/api/services'

const props = defineProps<{
  product: Product
  showAdd?: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  add: [id: string]
}>()

const discount = computed(() => getDiscountPercent(props.product))
const isNew = computed(() => props.product.soldCount < 40)

function starDisplay(rating: number) {
  const full = Math.round(rating)
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}
</script>

<template>
  <article
    class="card product-card product-card--mkt product-card--elegant"
    :class="{ 'product-card--compact': compact }"
  >
    <div class="product-card__media">
      <RouterLink :to="`/products/${product.id}`" class="product-card__img-link">
        <img :src="product.imageUrl" :alt="product.name" loading="lazy" />
      </RouterLink>

      <div class="product-card__badges">
        <span v-if="isNew" class="product-card__new">Mới</span>
        <span v-if="product.isFlashSale" class="product-card__sale">Sale</span>
        <span v-if="discount > 0" class="product-card__discount">-{{ discount }}%</span>
      </div>

      <button type="button" class="product-card__wish btn-interactive" aria-label="Thêm vào yêu thích">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>

      <div v-if="showAdd" class="product-card__overlay">
        <button type="button" class="product-card__add-btn btn-interactive" @click="emit('add', product.id)">
          Thêm vào giỏ
        </button>
      </div>
    </div>

    <div class="body">
      <p class="product-card__stars" :aria-label="`${product.rating} sao`">
        <span aria-hidden="true">{{ starDisplay(product.rating) }}</span>
      </p>
      <h3>
        <RouterLink :to="`/products/${product.id}`">{{ product.name }}</RouterLink>
      </h3>
      <div class="price-row">
        <p class="price">{{ formatVnd(product.price) }}</p>
        <span v-if="product.originalPrice && product.originalPrice > product.price" class="price-original">
          {{ formatVnd(product.originalPrice) }}
        </span>
      </div>
    </div>
  </article>
</template>
