<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    compact?: boolean
  }>(),
  {
    modelValue: '',
    placeholder: 'Tìm kiếm sản phẩm, thương hiệu...',
    compact: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  search: [query: string]
}>()

const route = useRoute()
const router = useRouter()
const query = ref(props.modelValue || (route.query.q as string) || '')

watch(
  () => props.modelValue,
  (v) => {
    if (v !== undefined) query.value = v
  },
)

function submit() {
  const q = query.value.trim()
  emit('update:modelValue', q)
  emit('search', q)
  router.push({ name: 'search', query: q ? { q } : {} })
}
</script>

<template>
  <form
    class="mkt-search"
    :class="{ 'mkt-search--compact': compact }"
    role="search"
    @submit.prevent="submit"
  >
    <label class="sr-only" for="mkt-search-input">Tìm kiếm</label>
    <input
      id="mkt-search-input"
      v-model="query"
      type="search"
      :placeholder="placeholder"
      autocomplete="off"
    />
    <button type="submit">Tìm kiếm</button>
  </form>
</template>
