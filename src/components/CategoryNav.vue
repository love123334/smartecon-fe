<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { productApi } from '@/api/services'
import { useAuthStore } from '@/stores/auth'
import { roleCategoryAiLink } from '@/utils/roleAiNav'

const auth = useAuthStore()
const categories = ref<string[]>([])

const categoryIcons: Record<string, string> = {
  'Điện tử': '📱',
  'Thời trang': '👕',
  'Thể thao': '⚽',
  Sách: '📚',
  'Gia dụng': '🏠',
  'Phụ kiện': '🎒',
}

const aiLink = computed(() => roleCategoryAiLink(auth.role, auth.isLoggedIn))

const aiTo = computed(() => {
  if (!auth.isLoggedIn) {
    return { path: '/login', query: { redirect: '/recommendations' } }
  }
  return aiLink.value.to
})

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
      <RouterLink :to="aiTo" class="mkt-cat-link mkt-cat-link--ai">
        <span aria-hidden="true">✨</span>
        {{ aiLink.label }}
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.mkt-cat-link--ai {
  color: #0f766e;
  font-weight: 600;
}
</style>
