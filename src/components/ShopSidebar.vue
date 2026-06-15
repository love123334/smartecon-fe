<script setup lang="ts">
const props = defineProps<{
  categories: string[]
  category: string
  priceRange: string
}>()

const emit = defineEmits<{
  'update:category': [value: string]
  'update:priceRange': [value: string]
}>()

const priceOptions = [
  { value: '', label: 'Tất cả mức giá' },
  { value: '0-500000', label: 'Dưới 500.000₫' },
  { value: '500000-2000000', label: '500.000₫ – 2.000.000₫' },
  { value: '2000000-10000000', label: '2.000.000₫ – 10.000.000₫' },
  { value: '10000000-', label: 'Trên 10.000.000₫' },
]

function pickCategory(cat: string) {
  emit('update:category', cat)
}

function pickPrice(value: string) {
  emit('update:priceRange', value)
}
</script>

<template>
  <aside class="shop-sidebar" aria-label="Bộ lọc sản phẩm">
    <div class="shop-sidebar__block">
      <h2 class="shop-sidebar__title">Danh mục</h2>
      <ul class="shop-sidebar__list">
        <li>
          <button
            type="button"
            class="shop-sidebar__link"
            :class="{ 'shop-sidebar__link--active': !category }"
            @click="pickCategory('')"
          >
            Tất cả
          </button>
        </li>
        <li v-for="cat in categories" :key="cat">
          <button
            type="button"
            class="shop-sidebar__link"
            :class="{ 'shop-sidebar__link--active': category === cat }"
            @click="pickCategory(cat)"
          >
            {{ cat }}
          </button>
        </li>
      </ul>
    </div>

    <div class="shop-sidebar__block">
      <h2 class="shop-sidebar__title">Giá</h2>
      <ul class="shop-sidebar__checks">
        <li v-for="opt in priceOptions" :key="opt.value">
          <label class="shop-sidebar__check">
            <input
              type="radio"
              name="price-range"
              :value="opt.value"
              :checked="priceRange === opt.value"
              @change="pickPrice(opt.value)"
            />
            <span>{{ opt.label }}</span>
          </label>
        </li>
      </ul>
    </div>
  </aside>
</template>
