<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { apiConfig } from '@/api/config'
import { dssApi } from '@/api/services'
import type { ChartPoint } from '@/types'
import HybridDataNotice from '@/components/HybridDataNotice.vue'
import BarChart from '@/components/BarChart.vue'
import PageHeader from '@/components/PageHeader.vue'

const categoryData = ref<ChartPoint[]>([])
const fromRealOrders = ref(false)
const loading = ref(true)

onMounted(async () => {
  loading.value = true
  try {
    categoryData.value = await dssApi.categoryChart()
    fromRealOrders.value = categoryData.value.length > 0 && apiConfig.useRealOrders
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Quản lý"
      title="Phân tích"
      lead="Doanh thu theo danh mục — từ đơn API khi có /orders/manage, không thì ước tính từ catalog."
    />

    <HybridDataNotice
      v-if="!fromRealOrders && apiConfig.useRealOrders"
      message="Chưa có GET /orders/manage — biểu đồ ước tính từ catalog sản phẩm backend (soldCount/giá)."
    />

    <div class="card">
      <h2>Doanh thu theo danh mục</h2>
      <BarChart v-if="categoryData.length" :data="categoryData" label="Doanh thu" />
      <p v-else-if="!loading" class="muted">Chưa có dữ liệu phân tích.</p>
      <p v-else class="muted">Đang tải…</p>
    </div>
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 1rem;
  font-size: 1rem;
}
</style>
