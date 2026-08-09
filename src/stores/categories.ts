import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { categoryApi } from '@/api/services'
import type { Category } from '@/api/real/categories'

/** Icon theo từ khóa tên danh mục API — không hard-code list tên cố định. */
export function iconForCategoryName(name: string): string {
  const n = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  if (/dien thoai|phone|smartphone/.test(n)) return '📱'
  if (/laptop|notebook|may tinh xach|may tinh bang/.test(n)) {
    if (/bang|tablet|ipad/.test(n)) return '📲'
    return '💻'
  }
  if (/tai nghe|headphone|phu kien|accessory/.test(n)) return '🎧'
  if (/giay|sneaker|dep/.test(n)) return '👟'
  if (/thoi trang nam|men fashion|ao nam/.test(n)) return '👔'
  if (/thoi trang nu|women|ao nu/.test(n)) return '👗'
  if (/thoi trang|fashion/.test(n)) return '👕'
  if (/cham soc da|skincare|serum/.test(n)) return '✨'
  if (/trang diem|makeup|lam dep/.test(n)) return '💄'
  if (/nha bep|kitchen|bep/.test(n)) return '🍳'
  if (/noi that|furniture/.test(n)) return '🛋️'
  if (/trang tri|decor/.test(n)) return '🖼️'
  if (/gia dung|nha cua|home/.test(n)) return '🏠'
  if (/the hinh|gym|fitness/.test(n)) return '🏋️'
  if (/da ngoai|outdoor|camping/.test(n)) return '🏕️'
  if (/the thao|sport/.test(n)) return '⚽'
  if (/sach|book/.test(n)) return '📚'
  if (/dien tu|electronic|tech|dss|demo/.test(n)) return '🔌'
  return '🏷️'
}

export const useCategoryStore = defineStore('categories', () => {
  const items = ref<Category[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')

  const names = computed(() => items.value.map((c) => c.name))

  async function load(force = false) {
    if (loading.value) return
    if (loaded.value && !force && items.value.length) return
    loading.value = true
    error.value = ''
    try {
      const list = await categoryApi.list(force)
      items.value = list.filter((c) => c.name?.trim())
      loaded.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Không tải được danh mục'
      if (!items.value.length) loaded.value = false
    } finally {
      loading.value = false
    }
  }

  return { items, names, loading, loaded, error, load, iconForCategoryName }
})
