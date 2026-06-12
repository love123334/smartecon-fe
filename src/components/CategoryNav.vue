<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { productApi } from '@/api/services'

const categories = ref<string[]>([])

const categoryIcons: Record<string, string> = {
  'Điện tử': '📱',
  'Thời trang': '👕',
  'Thể thao': '⚽',
  Sách: '📚',
  'Gia dụng': '🏠',
  'Phụ kiện': '🎒',
}

onMounted(async () => {
  categories.value = await productApi.categories()
})
</script>

<template>
  <nav class="mkt-categories" aria-label="Danh mục sản phẩm">
    <div class="container mkt-categories__scroll">
      <RouterLink to="/" class="mkt-cat-link mkt-cat-link--all">Trang chủ</RouterLink>
      <RouterLink
        v-for="cat in categories"
        :key="cat"
        :to="{ name: 'search', query: { category: cat } }"
        class="mkt-cat-link"
      >
        <span aria-hidden="true">{{ categoryIcons[cat] ?? '🏷️' }}</span>
        {{ cat }}
      </RouterLink>
      <RouterLink to="/recommendations" class="mkt-cat-link">
        <span aria-hidden="true">✨</span>
        Gợi ý AI
      </RouterLink>
    </div>
  </nav>
</template>
