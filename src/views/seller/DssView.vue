<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { dssApi } from '@/api/services'
import type { DssInsight, Product } from '@/types'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'
import AiShortcutBar from '@/components/AiShortcutBar.vue'
import { buildSellerDssModuleCards } from '@/utils/sellerDssModuleAi'
import { loadSellerCatalogForDss } from '@/utils/sellerCatalog'
import { formatViNumber } from '@/utils/demandPrediction'

const auth = useAuthStore()
const insights = ref<DssInsight[]>([])
const products = ref<Product[]>([])
const hubLoading = ref(true)

const sellerKey = computed(() => auth.user?.backendId ?? auth.user?.id)

const moduleCards = computed(() =>
  buildSellerDssModuleCards({
    insights: insights.value,
    products: products.value,
  }),
)

const topProduct = computed(
  () => [...products.value].sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0))[0] ?? null,
)

const lowStockCount = computed(
  () => products.value.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) < 20).length,
)

const businessPlanSections = computed(() => {
  const totalProducts = products.value.length
  const totalInsights = insights.value.length
  const topName = topProduct.value?.name?.trim() || 'một sản phẩm bán chạy'
  const topSold = topProduct.value?.soldCount ?? 0

  return [
    {
      title: 'Tổng quan kinh doanh',
      body: totalProducts
        ? `Danh mục hiện có ${formatViNumber(totalProducts)} sản phẩm${totalInsights ? ` và ${formatViNumber(totalInsights)} tín hiệu theo dõi` : ''}. ${lowStockCount.value ? `${formatViNumber(lowStockCount.value)} SKU đang gần hết hàng. ` : ''}Ưu tiên tập trung vào nhóm bán chạy trước để giữ nhịp doanh số ổn định.`
        : 'Chưa có sản phẩm trong danh mục. Khi có dữ liệu bán hàng, hệ thống sẽ giúp bạn nhìn nhanh các điểm cần ưu tiên.',
    },
    {
      title: 'Ưu tiên trong kỳ',
      body: totalProducts
        ? `Bắt đầu từ ${topName}${topSold ? ` với khoảng ${formatViNumber(topSold)} lượt bán` : ''}. Sau đó chạy Dự báo Nhu cầu, kiểm tra Gợi ý Giá bán và đối chiếu What-if Hiệu suất trước khi ra quyết định.`
        : 'Chuẩn bị dữ liệu sản phẩm và đơn hàng trước, sau đó mở từng chức năng để đánh giá nhu cầu, giá bán và hiệu suất.',
    },
    {
      title: 'Theo dõi tiếp',
      body: 'Cập nhật lại sau mỗi lần thay đổi giá, nhập hàng hoặc chạy khuyến mãi để giữ kế hoạch kinh doanh luôn bám sát số liệu thực tế.',
    },
  ]
})

onMounted(async () => {
  hubLoading.value = true
  try {
    const [ins, catalog] = await Promise.all([
      dssApi.sellerInsights(sellerKey.value),
      loadSellerCatalogForDss({ sellerId: sellerKey.value, withStock: false }),
    ])
    insights.value = ins
    products.value = catalog.products
  } finally {
    hubLoading.value = false
  }
})
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Người bán"
      title="Hỗ trợ ra quyết định (DSS)"
      lead="Hỗ trợ Nhà bán hàng đưa ra quyết định kinh doanh dựa trên các chỉ số phân tích từ lịch sử bán hàng."
    />

    <AiShortcutBar
      title="Chức năng:"
      :links="[
        { to: '/seller/dss/demand-lightgbm-demo', label: 'Dự báo Nhu cầu', highlight: true },
        { to: '/seller/dss/advanced-price', label: 'Gợi ý Giá bán', highlight: true },
        { to: '/seller/dss/order-economics', label: 'What-if Hiệu suất', highlight: true },
      ]"
    />

    <section class="dss-plan" aria-labelledby="dss-plan-title">
      <div class="dss-plan__head">
        <div>
          <h3 id="dss-plan-title">Kế hoạch kinh doanh</h3>
          <p>Tổng hợp ngắn gọn để xem nhanh tình hình và việc nên làm trong kỳ.</p>
        </div>
      </div>
      <div class="dss-plan__grid">
        <article v-for="section in businessPlanSections" :key="section.title" class="dss-plan__card">
          <h4>{{ section.title }}</h4>
          <p>{{ section.body }}</p>
        </article>
      </div>
    </section>

    <h3 class="dss-hub__section">Module DSS</h3>
    <p v-if="hubLoading" class="muted" role="status">Đang đọc catalog &amp; insight…</p>
    <div v-else class="dss-hub">
      <RouterLink
        v-for="card in moduleCards"
        :key="card.key"
        class="dss-hub__card"
        :class="`dss-hub__card--${card.tone}`"
        :to="card.to"
      >
        <div class="dss-hub__top">
          <span class="dss-hub__tag">{{ card.tag }}</span>
          <span class="dss-hub__badge" :class="`dss-hub__badge--${card.tone}`">{{ card.badge }}</span>
        </div>
        <h2>{{ card.title }}</h2>
        <p class="dss-hub__blurb">{{ card.blurb }}</p>
        <div class="dss-hub__summary">{{ card.summary }}</div>
        <span class="dss-hub__cta">Mở chức năng →</span>
      </RouterLink>
    </div>

    <h3 class="dss-hub__section">Gợi ý nhanh</h3>
    <div class="quick-links">
      <RouterLink to="/seller/orders" class="quick-links__card">
        <strong>Quản lý đơn hàng</strong>
        <span>Kiểm tra đơn, trạng thái xử lý và doanh số bán gần đây.</span>
      </RouterLink>
      <RouterLink to="/" class="quick-links__card">
        <strong>Quay về Cửa hàng</strong>
        <span>Xem trang chủ để quay lại trải nghiệm mua sắm như khách hàng.</span>
      </RouterLink>
      <RouterLink to="/seller/products" class="quick-links__card">
        <strong>Quản lý sản phẩm</strong>
        <span>Chỉnh danh mục, giá bán và dữ liệu sản phẩm trước khi phân tích.</span>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.dss-plan {
  margin-bottom: 1.5rem;
  padding: 1.15rem 1.25rem;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  background: linear-gradient(180deg, #f8fbff 0%, #fff 100%);
}

.dss-plan__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.dss-plan__head h3 {
  margin: 0;
  font-size: 1.05rem;
  color: #0d47a1;
}

.dss-plan__head p {
  margin: 0.35rem 0 0;
  color: #64748b;
  line-height: 1.5;
}

.dss-plan__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
}

.dss-plan__card {
  padding: 0.85rem 0.95rem;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #e8eef8;
}

.dss-plan__card h4 {
  margin: 0 0 0.35rem;
  font-size: 0.92rem;
  color: #1565c0;
}

.dss-plan__card p {
  margin: 0;
  color: #334155;
  font-size: 0.92rem;
  line-height: 1.55;
}

.dss-hub {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.dss-hub__card {
  display: flex;
  flex-direction: column;
  padding: 1.2rem 1.25rem 1.15rem;
  border-radius: 14px;
  border: 1px solid #e3e8ef;
  background: #fff;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.08);
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
  min-height: 100%;
}

.dss-hub__card:hover {
  border-color: #90caf9;
  box-shadow: 0 6px 18px rgba(25, 118, 210, 0.14);
  transform: translateY(-1px);
}

.dss-hub__card--strong {
  border-color: #90caf9;
  background: linear-gradient(180deg, #e8f1fb 0%, #fff 55%);
}

.dss-hub__card--steady {
  border-color: #b2dfdb;
  background: linear-gradient(180deg, #effaf7 0%, #fff 55%);
}

.dss-hub__card--soft {
  border-color: #ffe0b2;
  background: linear-gradient(180deg, #fff9f0 0%, #fff 55%);
}

.dss-hub__card--ok {
  border-color: #a5d6a7;
  background: linear-gradient(180deg, #f1f8f4 0%, #fff 55%);
}

.dss-hub__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.dss-hub__tag {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #1565c0;
  background: #e3f2fd;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
}

.dss-hub__badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: #eceff1;
  color: #455a64;
}

.dss-hub__badge--strong {
  background: #0d47a1;
  color: #fff;
}

.dss-hub__badge--steady {
  background: #1565c0;
  color: #fff;
}

.dss-hub__badge--soft {
  background: #ef6c00;
  color: #fff;
}

.dss-hub__badge--ok {
  background: #2e7d32;
  color: #fff;
}

.dss-hub__card h2 {
  margin: 0.55rem 0 0.3rem;
  font-size: 1.12rem;
  color: #0d47a1;
}

.dss-hub__blurb {
  margin: 0;
  color: #64748b;
  font-size: 0.8125rem;
  line-height: 1.45;
}

.dss-hub__summary {
  margin-top: 0.85rem;
  padding: 0.75rem 0.85rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #e8eef8;
  color: #475569;
  font-size: 0.84rem;
  line-height: 1.55;
  flex: 1;
}

.dss-hub__cta {
  display: inline-block;
  margin-top: 0.85rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #1565c0;
}

.dss-hub__section {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  color: #0d47a1;
}

.quick-links {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
}

.quick-links__card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.95rem 1rem;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #fff;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
  box-shadow: 0 1px 6px rgba(15, 23, 42, 0.04);
}

.quick-links__card:hover {
  border-color: #90caf9;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(25, 118, 210, 0.12);
}

.quick-links__card strong {
  color: #0d47a1;
  font-size: 0.96rem;
}

.quick-links__card span {
  color: #64748b;
  font-size: 0.84rem;
  line-height: 1.5;
}

:deep(.page-lead) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 900px) {
  .dss-plan__grid,
  .dss-hub,
  .quick-links {
    grid-template-columns: 1fr;
  }

  :deep(.page-lead) {
    white-space: normal;
  }
}
</style>
