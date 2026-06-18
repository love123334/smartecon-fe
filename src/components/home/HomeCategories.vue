<script setup lang="ts">
import { RouterLink } from 'vue-router'

const categories = [
  {
    name: 'Điện tử',
    desc: 'Tai nghe, loa, thiết bị thông minh',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80',
    query: 'Điện tử',
  },
  {
    name: 'Thời trang',
    desc: 'Phụ kiện và gear lifestyle',
    image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&q=80',
    query: 'Thời trang',
  },
  {
    name: 'Thể thao',
    desc: 'Đồ tập, wearable, outdoor',
    image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80',
    query: 'Thể thao',
  },
  {
    name: 'Gia dụng',
    desc: 'Nhà bếp, không gian sống',
    image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&q=80',
    query: 'Gia dụng',
  },
]
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
