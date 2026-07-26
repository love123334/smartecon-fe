<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { categoryApi } from '@/api/services'

const FALLBACK = [
  {
    name: 'Điện tử',
    desc: 'Tai nghe, loa, thiết bị thông minh',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80',
  },
  {
    name: 'Thời trang',
    desc: 'Phụ kiện và gear lifestyle',
    image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&q=80',
  },
  {
    name: 'Thể thao',
    desc: 'Đồ tập, wearable, outdoor',
    image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80',
  },
  {
    name: 'Gia dụng',
    desc: 'Nhà bếp, không gian sống',
    image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&q=80',
  },
  {
    name: 'Sách',
    desc: 'Sách kỹ thuật & phát triển',
    image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&q=80',
  },
  {
    name: 'Phụ kiện',
    desc: 'Balo, kính, phụ kiện hàng ngày',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80',
  },
]

const IMAGE_BY_NAME: Record<string, string> = Object.fromEntries(
  FALLBACK.map((c) => [c.name.toLowerCase(), c.image]),
)

const categories = ref(
  FALLBACK.map((c) => ({
    name: c.name,
    desc: c.desc,
    image: c.image,
    query: c.name,
  })),
)

onMounted(async () => {
  try {
    const list = await categoryApi.list(true)
    if (!list.length) return
    categories.value = list.map((c) => {
      const fb = FALLBACK.find((f) => f.name.toLowerCase() === c.name.toLowerCase())
      return {
        name: c.name,
        desc: fb?.desc ?? `Khám phá sản phẩm ${c.name}`,
        image:
          IMAGE_BY_NAME[c.name.toLowerCase()] ??
          `https://picsum.photos/seed/cat-${c.slug}/600/400`,
        query: c.name,
      }
    })
  } catch {
    /* giữ fallback */
  }
})
</script>

<template>
  <section class="home-categories" aria-labelledby="home-cat-title">
    <div class="container">
      <div class="home-section-head">
        <div>
          <h2 id="home-cat-title" class="home-section-head__title">Danh mục nổi bật</h2>
          <p class="home-section-head__sub">Chọn không gian bạn muốn khám phá</p>
        </div>
        <RouterLink to="/search" class="home-section-head__link btn-interactive">
          Xem tất cả →
        </RouterLink>
      </div>

      <div class="home-categories__grid">
        <RouterLink
          v-for="cat in categories"
          :key="cat.name"
          :to="{ path: '/search', query: { category: cat.query } }"
          class="home-cat-card reveal-up btn-interactive"
        >
          <img :src="cat.image" :alt="cat.name" loading="lazy" />
          <div class="home-cat-card__overlay">
            <h3>{{ cat.name }}</h3>
            <p>{{ cat.desc }}</p>
            <span class="home-cat-card__cta">Mua ngay →</span>
          </div>
        </RouterLink>
      </div>
    </div>
  </section>
</template>
