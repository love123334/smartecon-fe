<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { dssApi } from '@/api/services'
import type { ChartPoint } from '@/types'
import BarChart from '@/components/BarChart.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'

const categoryData = ref<ChartPoint[]>([])
const loading = ref(true)

onMounted(async () => {
  loading.value = true
  try {
    categoryData.value = await dssApi.categoryChart()
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
      lead="Doanh thu theo danh mục trên toàn sàn."
    />

    <div class="card">
      <h2>Doanh thu theo danh mục</h2>
      <BarChart v-if="categoryData.length" :data="categoryData" label="Doanh thu" />
      <p v-else-if="!loading" class="muted">Chưa có dữ liệu phân tích.</p>
      <LoadingSpinner v-else size="sm" label="Đang tải" />
    </div>
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 1rem;
  font-size: 1rem;
}
</style>
