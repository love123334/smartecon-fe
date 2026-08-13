<script setup lang="ts">
import type { DssPriceChangeImpactApi, DssProductContextApi } from '@/api/real/dss'

defineProps<{
  productContext?: DssProductContextApi | null
  priceChangeImpacts?: DssPriceChangeImpactApi[] | null
}>()

function tierLabel(tier?: string) {
  switch (tier) {
    case 'TOP':
      return 'Bán chạy'
    case 'MID':
      return 'Trung bình'
    case 'LOW':
      return 'Bán chậm'
    case 'ONLY':
      return 'SP duy nhất / mới'
    default:
      return tier ?? '—'
  }
}
</script>

<template>
  <section
    v-if="productContext || (priceChangeImpacts?.length ?? 0)"
    class="dss-card dss-context-panel"
    aria-labelledby="dss-context-title"
  >
    <h2 id="dss-context-title" class="dss-card__title">Ngữ cảnh sản phẩm</h2>

    <article v-if="productContext" class="dss-context-block">
      <h3 class="dss-context-block__title">Vị thế trong shop</h3>
      <p class="dss-meta">
        <span>Đăng bán</span>{{ productContext.daysListed ?? '—' }} ngày
        <template v-if="productContext.shopSalesRank && productContext.shopProductCount">
          · Hạng #{{ productContext.shopSalesRank }}/{{ productContext.shopProductCount }}
        </template>
        · {{ tierLabel(productContext.performanceTier) }}
      </p>
      <p v-if="productContext.performanceSummary" class="dss-hint">{{ productContext.performanceSummary }}</p>
      <p v-if="productContext.priceChangeCount != null" class="dss-meta">
        <span>Chỉnh giá trong kỳ</span>{{ productContext.priceChangeCount }} lần
      </p>
    </article>

    <article v-if="priceChangeImpacts?.length" class="dss-context-block">
      <h3 class="dss-context-block__title">Tác động chỉnh giá lên lượt mua</h3>
      <ul class="dss-context-list">
        <li v-for="(p, i) in priceChangeImpacts" :key="i">{{ p.summary }}</li>
      </ul>
    </article>

  </section>
</template>

<style scoped>
.dss-context-panel {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.dss-context-block__title {
  margin: 0 0 0.45rem;
  font-size: 0.92rem;
  font-weight: 700;
}

.dss-context-list {
  margin: 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  font-size: 0.88rem;
  line-height: 1.45;
}
</style>
