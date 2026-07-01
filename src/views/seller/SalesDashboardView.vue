<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { dssApi } from '@/api/services'
import type { ChartPoint } from '@/types'
import { useAuthStore } from '@/stores/auth'
import HybridDataNotice from '@/components/HybridDataNotice.vue'
import LineChart from '@/components/LineChart.vue'
import PageHeader from '@/components/PageHeader.vue'

const auth = useAuthStore()
const salesData = ref<ChartPoint[]>([])

const sellerKey = computed(() => auth.user?.backendId ?? auth.user?.id)

onMounted(async () => {
  salesData.value = await dssApi.salesChart(sellerKey.value)
})
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Người bán"
      title="Bảng doanh số"
      lead="Ước tính doanh thu từ sản phẩm & lượt bán thực tế."
    />
    <HybridDataNotice
      message="Biểu đồ phân bổ theo tháng từ dữ liệu bán hàng; chưa có API analytics riêng."
    />
    <div class="card">
      <h2>Doanh thu theo tháng</h2>
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
