<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { dssApi } from '@/api/services'
import type { ChartPoint } from '@/types'
import BarChart from '@/components/BarChart.vue'

const categoryData = ref<ChartPoint[]>([])

onMounted(async () => {
  categoryData.value = await dssApi.categoryChart()
})
</script>

<template>
  <div>
    <h1 class="page-title">Phân tích</h1>
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
