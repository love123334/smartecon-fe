<script setup lang="ts">
import { formatVndCurrency } from '@/utils/pricePrediction'

export interface ProfitBreakdown {
  revenue?: number
  costOfGoodsSold?: number
  deliveryCost?: number
  platformFee?: number
  operatingCost?: number
  grossProfit?: number
  netProfit?: number
  costNotes?: string[]
}

defineProps<{
  title?: string
  breakdown: ProfitBreakdown | null | undefined
}>()
</script>

<template>
  <div v-if="breakdown" class="dss-profit-panel">
    <h3 v-if="title" class="dss-profit-panel__title">{{ title }}</h3>
    <dl class="dss-profit-panel__grid">
      <div><dt>Doanh thu</dt><dd>{{ formatVndCurrency(breakdown.revenue ?? 0) }}</dd></div>
      <div><dt>Giá vốn (COGS)</dt><dd>{{ formatVndCurrency(breakdown.costOfGoodsSold ?? 0) }}</dd></div>
      <div><dt>Chi phí giao hàng</dt><dd>{{ formatVndCurrency(breakdown.deliveryCost ?? 0) }}</dd></div>
      <div><dt>Phí nền tảng</dt><dd>{{ formatVndCurrency(breakdown.platformFee ?? 0) }}</dd></div>
      <div><dt>Chi phí vận hành</dt><dd>{{ formatVndCurrency(breakdown.operatingCost ?? 0) }}</dd></div>
      <div class="dss-profit-panel__highlight">
        <dt>Lợi nhuận gộp</dt><dd>{{ formatVndCurrency(breakdown.grossProfit ?? 0) }}</dd>
      </div>
      <div class="dss-profit-panel__highlight dss-profit-panel__net">
        <dt>Lợi nhuận ròng</dt><dd>{{ formatVndCurrency(breakdown.netProfit ?? 0) }}</dd>
      </div>
    </dl>
    <ul v-if="breakdown.costNotes?.length" class="dss-profit-panel__notes">
      <li v-for="(note, i) in breakdown.costNotes" :key="i">{{ note }}</li>
    </ul>
  </div>
</template>

<style scoped>
.dss-profit-panel {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 10px;
  background: var(--dss-surface-muted, #f8fafc);
  border: 1px solid var(--dss-border, #e2e8f0);
}
.dss-profit-panel__title {
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
  font-weight: 600;
}
.dss-profit-panel__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.65rem 1rem;
  margin: 0;
}
.dss-profit-panel__grid dt {
  font-size: 0.75rem;
  color: #64748b;
  margin: 0;
}
.dss-profit-panel__grid dd {
  margin: 0.15rem 0 0;
  font-weight: 600;
  font-size: 0.9rem;
}
.dss-profit-panel__highlight dd {
  color: #0f766e;
}
.dss-profit-panel__net dd {
  color: #b45309;
  font-size: 1rem;
}
.dss-profit-panel__notes {
  margin: 0.75rem 0 0;
  padding-left: 1.1rem;
  font-size: 0.78rem;
  color: #64748b;
  line-height: 1.45;
}
</style>
