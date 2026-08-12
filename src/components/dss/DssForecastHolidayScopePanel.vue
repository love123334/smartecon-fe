<script setup lang="ts">
import { computed } from 'vue'
import type { DssHolidayImpactApi } from '@/api/real/dss'
import { formatViDate, formatViNumber } from '@/utils/demandPrediction'

const props = defineProps<{
  forecastFrom?: string | null
  forecastTo?: string | null
  forecastPeriodLabel?: string | null
  upcomingHolidays?: DssHolidayImpactApi[] | null
  holidayAdjustmentFactor?: number | null
}>()

const scopeRange = computed(() => {
  if (props.forecastFrom && props.forecastTo) {
    return `${formatViDate(props.forecastFrom)} → ${formatViDate(props.forecastTo)}`
  }
  return null
})

const hasHolidays = computed(() => (props.upcomingHolidays?.length ?? 0) > 0)
</script>

<template>
  <section class="dss-card dss-holiday-scope" aria-labelledby="dss-holiday-scope-title">
    <div class="dss-holiday-scope__head">
      <div>
        <h2 id="dss-holiday-scope-title" class="dss-card__title">
          Phạm vi dự báo & ngày lễ / khuyến mãi
        </h2>
        <p v-if="forecastPeriodLabel" class="dss-holiday-scope__lead">{{ forecastPeriodLabel }}</p>
        <p v-else-if="scopeRange" class="dss-holiday-scope__lead">
          Phạm vi dự báo: <strong>{{ scopeRange }}</strong>
        </p>
      </div>
      <div
        v-if="holidayAdjustmentFactor != null && holidayAdjustmentFactor !== 1"
        class="dss-holiday-scope__factor"
        title="Hệ số điều chỉnh nhu cầu do mùa vụ + ngày lễ so với dự báo phẳng"
      >
        <span>Hệ số lễ tổng</span>
        <strong>×{{ formatViNumber(holidayAdjustmentFactor) }}</strong>
      </div>
    </div>

    <p v-if="!hasHolidays" class="dss-holiday-scope__empty" role="status">
      Trong kỳ dự báo này không trùng ngày lễ lớn hay mega sale (11.11, Black Friday, ngày đôi…).
      Dự báo chủ yếu dựa trên xu hướng bán và mùa vụ theo thứ trong tuần.
    </p>

    <div v-else class="dss-holiday-scope__table-wrap">
      <table class="dss-holiday-scope__table">
        <caption class="sr-only">
          Các sự kiện ảnh hưởng nhu cầu và áp lực giá trong phạm vi dự báo
        </caption>
        <thead>
          <tr>
            <th scope="col">Sự kiện</th>
            <th scope="col">Thời gian</th>
            <th scope="col">Nhu cầu</th>
            <th scope="col">Tác động giá / khuyến mãi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="h in upcomingHolidays" :key="`${h.code}-${h.start}`">
            <td>
              <strong class="dss-holiday-scope__event">{{ h.label }}</strong>
              <span v-if="h.note" class="dss-holiday-scope__demand-note">{{ h.note }}</span>
            </td>
            <td class="dss-holiday-scope__dates">
              {{ formatViDate(h.start) }} – {{ formatViDate(h.end) }}
            </td>
            <td class="dss-holiday-scope__mult">
              <span class="dss-badge dss-badge--best">×{{ formatViNumber(h.demandMultiplier) }}</span>
            </td>
            <td class="dss-holiday-scope__price">
              {{ h.priceImpactNote || 'Cạnh tranh khuyến mãi — theo dõi giá đối thủ trong kỳ sự kiện.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="dss-hint dss-holiday-scope__footnote">
      Hệ số nhu cầu (×) là ước lượng theo lịch TMĐT VN — đã cộng vào đường dự báo trên biểu đồ.
      Gợi ý giá giúp bạn chuẩn bị tồn kho và kịch bản khuyến mãi, không thay thế quyết định kinh doanh.
    </p>
  </section>
</template>

<style scoped>
.dss-holiday-scope {
  border-left: 4px solid var(--brand-500, #2563eb);
}

.dss-holiday-scope__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
}

.dss-holiday-scope__lead {
  margin: 0.35rem 0 0;
  font-size: 0.92rem;
  color: var(--slate-700, #334155);
  line-height: 1.45;
}

.dss-holiday-scope__factor {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.15rem;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  background: var(--slate-50, #f8fafc);
  font-size: 0.78rem;
  color: var(--slate-600, #64748b);
}

.dss-holiday-scope__factor strong {
  font-size: 1.1rem;
  color: var(--brand-600, #1d4ed8);
}

.dss-holiday-scope__empty {
  margin: 0;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: var(--slate-50, #f8fafc);
  font-size: 0.88rem;
  line-height: 1.5;
  color: var(--slate-700, #334155);
}

.dss-holiday-scope__table-wrap {
  overflow-x: auto;
  margin-bottom: 0.65rem;
}

.dss-holiday-scope__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
  line-height: 1.45;
}

.dss-holiday-scope__table th,
.dss-holiday-scope__table td {
  padding: 0.55rem 0.65rem;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--slate-200, #e2e8f0);
}

.dss-holiday-scope__table th {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--slate-600, #64748b);
  background: var(--slate-50, #f8fafc);
}

.dss-holiday-scope__event {
  display: block;
  margin-bottom: 0.2rem;
}

.dss-holiday-scope__demand-note {
  display: block;
  font-size: 0.8rem;
  color: var(--slate-600, #64748b);
  font-weight: 400;
}

.dss-holiday-scope__dates {
  white-space: nowrap;
}

.dss-holiday-scope__mult {
  white-space: nowrap;
}

.dss-holiday-scope__price {
  max-width: 280px;
  color: var(--slate-800, #1e293b);
}

.dss-holiday-scope__footnote {
  margin: 0;
  font-size: 0.78rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
