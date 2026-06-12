<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { dssApi } from '@/api/services'
import type { ChartPoint } from '@/types'
import LineChart from '@/components/LineChart.vue'

const salesData = ref<ChartPoint[]>([])

onMounted(async () => {
  salesData.value = await dssApi.salesChart()
})
</script>

<template>
  <div>
    <h1 class="page-title">Bảng doanh số</h1>
    <div class="card">
      <h2>Doanh thu theo tháng (mock)</h2>
      <LineChart v-if="salesData.length" :data="salesData" label="Doanh thu (VND)" />
    </div>
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 1rem;
  font-size: 1rem;
}
</style>
