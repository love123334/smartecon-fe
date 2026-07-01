<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { dssApi } from '@/api/services'
import type { ChartPoint } from '@/types'
import HybridDataNotice from '@/components/HybridDataNotice.vue'
import BarChart from '@/components/BarChart.vue'
import PageHeader from '@/components/PageHeader.vue'

const categoryData = ref<ChartPoint[]>([])

onMounted(async () => {
  categoryData.value = await dssApi.categoryChart()
})
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Quản lý"
      title="Phân tích"
      lead="Phân bổ doanh thu theo danh mục sản phẩm."
    />
    <HybridDataNotice message="Ước tính từ catalog sản phẩm; chưa có API analytics chuyên dụng." />
    <div class="card">
      <h2>Doanh thu theo danh mục (ước tính)</h2>
      <BarChart v-if="categoryData.length" :data="categoryData" label="Chỉ số" />
    </div>
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 1rem;
  font-size: 1rem;
}
</style>
