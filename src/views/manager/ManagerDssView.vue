<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { dssApi } from '@/api/services'
import type { DssInsight } from '@/types'
import PageHeader from '@/components/PageHeader.vue'
import AiShortcutBar from '@/components/AiShortcutBar.vue'
import { LOOKER_STUDIO_PLATFORM_REVENUE_URL } from '@/constants/lookerStudio'
import { buildManagerDssCommentary } from '@/utils/dssCommentary'

const insights = ref<DssInsight[]>([])
const planLoading = ref(false)
const planError = ref('')
const lookerLoaded = ref(false)
const lookerFailed = ref(false)
let lookerTimer: ReturnType<typeof setTimeout> | null = null

const commentary = computed(() => buildManagerDssCommentary(insights.value))

onMounted(async () => {
  lookerTimer = setTimeout(() => {
    if (!lookerLoaded.value) lookerFailed.value = true
  }, 12_000)

  planLoading.value = true
  planError.value = ''
  try {
    insights.value = await dssApi.managerInsights()
  } catch (e) {
    planError.value = e instanceof Error ? e.message : 'Không tải được gợi ý DSS quản lý'
  } finally {
    planLoading.value = false
  }
})

onUnmounted(() => {
  if (lookerTimer) clearTimeout(lookerTimer)
})

function onLookerLoad() {
  lookerLoaded.value = true
  lookerFailed.value = false
  if (lookerTimer) {
    clearTimeout(lookerTimer)
    lookerTimer = null
  }
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Quản lý"
      title="DSS Quản lý"
      lead="Theo dõi doanh thu sàn qua Looker Studio và nhận gợi ý vận hành toàn nền tảng."
    />
    <AiShortcutBar
      title="Tiếp theo:"
      :links="[
        { to: '/manager/platform-revenue', label: 'Doanh thu sàn', highlight: true },
        { to: '/manager/dashboard', label: 'Dashboard KPI', highlight: true },
        { to: '/manager/analytics', label: 'Phân tích' },
      ]"
    />

    <section class="dss-looker card" aria-label="Looker Studio — Platform Revenue">
      <div class="dss-looker__head">
        <div>
          <h2 class="dss-looker__title">Looker Studio — Doanh thu sàn</h2>
          <p class="muted dss-looker__lead">
            Báo cáo Platform Revenue Management nhúng trực tiếp (cùng nguồn với trang Doanh thu sàn).
          </p>
        </div>
        <a
          class="btn btn-outline btn-sm"
          :href="LOOKER_STUDIO_PLATFORM_REVENUE_URL"
          target="_blank"
          rel="noopener noreferrer"
        >
          Mở full báo cáo
        </a>
      </div>
      <div class="dss-looker__frame-wrap">
        <p v-if="!lookerLoaded && !lookerFailed" class="dss-looker__loading muted" role="status">
          Đang tải Looker Studio…
        </p>
        <div v-if="lookerFailed && !lookerLoaded" class="dss-looker__fallback" role="status">
          <p>Không nhúng được Looker trong trang.</p>
          <a
            class="btn btn-outline btn-sm"
            :href="LOOKER_STUDIO_PLATFORM_REVENUE_URL"
            target="_blank"
            rel="noopener noreferrer"
          >
            Mở full báo cáo
          </a>
        </div>
        <iframe
          class="dss-looker__frame"
          title="Platform Revenue Management — Looker Studio"
          :src="LOOKER_STUDIO_PLATFORM_REVENUE_URL"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          allowfullscreen
          @load="onLookerLoad"
        />
      </div>
    </section>

    <section class="dss-brain">
      <div class="dss-brain__head">
        <h3>Nhận xét & kế hoạch vận hành</h3>
      </div>
      <p v-if="planLoading">Đang tổng hợp số liệu…</p>
      <p v-else-if="planError" class="dss-brain__err">{{ planError }}</p>
      <pre v-else class="dss-brain__md">{{ commentary }}</pre>
    </section>

    <div class="dss-hub">
      <RouterLink class="dss-hub__card" to="/manager/platform-revenue">
        <span class="dss-hub__tag">Revenue</span>
        <h2>Platform Revenue</h2>
        <p>GMV toàn sàn · xu hướng · top sellers/products · Looker Studio + API live.</p>
        <span class="dss-hub__cta">Mở →</span>
      </RouterLink>
      <RouterLink class="dss-hub__card" to="/manager/analytics">
        <span class="dss-hub__tag">Phân tích</span>
        <h2>Phân tích danh mục</h2>
        <p>Theo dõi hiệu suất danh mục và xu hướng vận hành sàn.</p>
        <span class="dss-hub__cta">Mở →</span>
      </RouterLink>
      <RouterLink class="dss-hub__card" to="/manager/dashboard">
        <span class="dss-hub__tag">KPI</span>
        <h2>Dashboard quản lý</h2>
        <p>Tổng quan đơn hàng, doanh thu và trạng thái vận hành.</p>
        <span class="dss-hub__cta">Mở →</span>
      </RouterLink>
    </div>

    <h3 class="dss-hub__section">Gợi ý nhanh</h3>
    <div class="grid grid-2">
      <article v-for="i in insights" :key="i.id" class="card">
        <h3>{{ i.title }}</h3>
        <p>{{ i.description }}</p>
        <span class="badge badge-confirmed">{{ i.category }}</span>
      </article>
    </div>

    <p class="dss-seller-note muted">
      Phân tích <strong>What-if giảm giá</strong> (mô phỏng lợi nhuận theo sản phẩm) dành cho
      <strong>Người bán</strong> tại
      <code>/seller/dss/what-if</code> — không nằm trong DSS quản lý.
    </p>
  </div>
</template>

<style scoped>
.dss-looker {
  margin: 0 0 1.25rem;
  padding: 1rem 1.1rem 1.15rem;
  overflow: hidden;
}
.dss-looker__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  margin-bottom: 0.85rem;
}
.dss-looker__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--navy, #14275c);
}
.dss-looker__lead {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
}
.dss-looker__frame-wrap {
  position: relative;
  width: 100%;
  min-height: 640px;
  border: 1px solid var(--line, #e4e9f2);
  border-radius: 12px;
  overflow: hidden;
  background: #f8fafc;
}
.dss-looker__loading,
.dss-looker__fallback {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  margin: 0;
  padding: 1rem;
  text-align: center;
  background: rgba(248, 250, 252, 0.95);
}
.dss-looker__fallback {
  gap: 0.75rem;
  z-index: 2;
}
.dss-looker__frame {
  display: block;
  width: 100%;
  height: 640px;
  border: 0;
  background: #fff;
}
@media (max-width: 768px) {
  .dss-looker__frame-wrap,
  .dss-looker__frame {
    min-height: 520px;
    height: 520px;
  }
}
.dss-brain {
  margin-bottom: 1.5rem;
  padding: 1.15rem 1.25rem;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  background: linear-gradient(180deg, #f8fbff 0%, #fff 100%);
}
.dss-brain__head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.dss-brain__head h3 {
  margin: 0;
  font-size: 1.05rem;
  color: #0d47a1;
}
.dss-brain__md {
  margin: 0;
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 0.92rem;
  line-height: 1.55;
}
.dss-brain__err {
  color: #b91c1c;
}
.dss-hub {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.dss-hub__card {
  display: block;
  padding: 1.25rem 1.35rem;
  border-radius: 14px;
  background: #fff;
  border: 1px solid #e3e8ef;
  text-decoration: none;
  color: inherit;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.dss-hub__card:hover {
  border-color: #90caf9;
  text-decoration: none;
}
.dss-hub__tag {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #1565c0;
  background: #e3f2fd;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  margin-bottom: 0.65rem;
}
.dss-hub__card h2 {
  margin: 0 0 0.4rem;
  font-size: 1.1rem;
}
.dss-hub__card p {
  margin: 0;
  color: #64748b;
  font-size: 0.9rem;
}
.dss-hub__cta {
  display: inline-block;
  margin-top: 0.85rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: #1565c0;
}
.dss-hub__section {
  margin: 0 0 0.75rem;
}
.dss-seller-note {
  margin: 1rem 0 0;
  font-size: 0.85rem;
}
@media (max-width: 900px) {
  .dss-hub {
    grid-template-columns: 1fr;
  }
}
</style>
