<script setup lang="ts">
import type {
  DssAiInsightApi,
  DssHolidayImpactApi,
  DssPriceChangeImpactApi,
  DssProductContextApi,
} from '@/api/real/dss'

defineProps<{
  productContext?: DssProductContextApi | null
  upcomingHolidays?: DssHolidayImpactApi[] | null
  priceChangeImpacts?: DssPriceChangeImpactApi[] | null
  aiInsight?: DssAiInsightApi | null
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
    v-if="productContext || (upcomingHolidays?.length ?? 0) || (priceChangeImpacts?.length ?? 0) || aiInsight"
    class="dss-card dss-context-panel"
    aria-labelledby="dss-context-title"
  >
    <h2 id="dss-context-title" class="dss-card__title">Ngữ cảnh & phân tích nâng cao</h2>

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

    <article v-if="upcomingHolidays?.length" class="dss-context-block">
      <h3 class="dss-context-block__title">Sự kiện / khuyến mãi ảnh hưởng dự báo</h3>
      <ul class="dss-context-list">
        <li v-for="h in upcomingHolidays" :key="`${h.code}-${h.start}`">
          <strong>{{ h.label }}</strong>
          ({{ h.start }} → {{ h.end }}, hệ số ×{{ h.demandMultiplier }})
          <span v-if="h.note" class="dss-hint"> — {{ h.note }}</span>
        </li>
      </ul>
    </article>

    <article v-if="priceChangeImpacts?.length" class="dss-context-block">
      <h3 class="dss-context-block__title">Tác động chỉnh giá lên lượt mua</h3>
      <ul class="dss-context-list">
        <li v-for="(p, i) in priceChangeImpacts" :key="i">{{ p.summary }}</li>
      </ul>
    </article>

    <article v-if="aiInsight" class="dss-context-block dss-ai-block">
      <div class="dss-ai-block__head">
        <h3 class="dss-context-block__title">{{ aiInsight.title }}</h3>
        <span class="dss-badge" :class="aiInsight.fallback ? 'dss-badge--muted' : 'dss-badge--best'">
          {{ aiInsight.fallback ? 'Phân tích nội bộ' : `AI · ${aiInsight.provider ?? 'API'}` }}
        </span>
      </div>
      <div class="dss-ai-block__body" v-html="aiInsight.summary.replace(/\n/g, '<br>')" />
      <p v-if="aiInsight.disclaimer" class="dss-hint dss-ai-disclaimer">{{ aiInsight.disclaimer }}</p>
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

.dss-ai-block__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  justify-content: space-between;
}

.dss-ai-block__body {
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--slate-800, #14275c);
}

.dss-ai-disclaimer {
  margin: 0.65rem 0 0;
  font-size: 0.78rem;
}

.dss-badge--muted {
  background: var(--slate-100, #eef1f6);
  color: var(--slate-600, #5b6c93);
}
</style>
