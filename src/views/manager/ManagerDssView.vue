<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { dssApi } from '@/api/services'
import type { DssInsight } from '@/types'

const insights = ref<DssInsight[]>([])

onMounted(async () => {
  insights.value = await dssApi.managerInsights()
})
</script>

<template>
  <div>
    <h1 class="page-title">DSS Quản lý</h1>
    <div class="grid grid-2">
      <article v-for="i in insights" :key="i.id" class="card">
        <h3>{{ i.title }}</h3>
        <p>{{ i.description }}</p>
        <span class="badge badge-confirmed">{{ i.category }}</span>
      </article>
    </div>
  </div>
</template>

<style scoped>
h3 {
  margin: 0 0 0.5rem;
}
</style>
