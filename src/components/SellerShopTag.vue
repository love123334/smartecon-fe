<script setup lang="ts">
import { computed } from 'vue'
import type { Product } from '@/types'
import { sellerDisplayName, sellerTagCode, sellerTagStyle } from '@/utils/sellerTag'

const props = withDefaults(
  defineProps<{
    product: Pick<Product, 'shopName' | 'sellerId'>
    /** sm = card, md = chi tiết SP */
    size?: 'sm' | 'md'
    showName?: boolean
  }>(),
  { size: 'sm', showName: true },
)

const label = computed(() => sellerDisplayName(props.product))
const code = computed(() => sellerTagCode(props.product.sellerId))
const style = computed(() => sellerTagStyle(props.product.sellerId))
</script>

<template>
  <span
    class="seller-tag"
    :class="[`seller-tag--${size}`]"
    :style="style"
    :title="`Người bán: ${label} (${code})`"
  >
    <span class="seller-tag__code">{{ code }}</span>
    <span v-if="showName" class="seller-tag__name">{{ label }}</span>
  </span>
</template>

<style scoped>
.seller-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  max-width: 100%;
  border: 1px solid;
  border-radius: 999px;
  font-weight: 600;
  line-height: 1.2;
  vertical-align: middle;
}

.seller-tag--sm {
  padding: 0.15rem 0.45rem;
  font-size: 0.68rem;
}

.seller-tag--md {
  padding: 0.3rem 0.65rem;
  font-size: 0.8rem;
}

.seller-tag__code {
  flex-shrink: 0;
  opacity: 0.85;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.seller-tag__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 9.5rem;
}
</style>
