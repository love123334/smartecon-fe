<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { categoryApi } from '@/api/services'

const router = useRouter()

/** Ảnh khớp danh mục — tránh picsum / ảnh lệch nghĩa */
const IMAGE_BY_NAME: Record<string, { image: string; desc: string }> = {
  'điện tử': {
    image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80',
    desc: 'Thiết bị & phụ kiện số',
  },
  'điện thoại': {
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80',
    desc: 'Smartphone & phụ kiện',
  },
  laptop: {
    image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80',
    desc: 'Laptop học tập & làm việc',
  },
  'máy tính bảng': {
    image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&q=80',
    desc: 'Tablet & bút cảm ứng',
  },
  'phụ kiện': {
    image: 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=800&q=80',
    desc: 'Cáp, ốp, tai nghe',
  },
  'thời trang': {
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80',
    desc: 'Phong cách hàng ngày',
  },
  'thời trang nam': {
    image: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800&q=80',
    desc: 'Áo thun, sơ mi, basics',
  },
  'thời trang nữ': {
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80',
    desc: 'Đầm, áo, phụ kiện nữ',
  },
  'giày dép': {
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
    desc: 'Sneaker & giày thể thao',
  },
  'làm đẹp': {
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80',
    desc: 'Chăm sóc & làm đẹp',
  },
  'chăm sóc da': {
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80',
    desc: 'Skincare hàng ngày',
  },
  'nhà bếp': {
    image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80',
    desc: 'Nồi, chảo, thiết bị bếp',
  },
  'gia dụng': {
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80',
    desc: 'Đồ dùng nhà cửa',
  },
  'nội thất': {
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80',
    desc: 'Bàn ghế & không gian sống',
  },
  'thể thao': {
    image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80',
    desc: 'Tập luyện & outdoor',
  },
  'thiết bị thể hình': {
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80',
    desc: 'Tạ, band, máy tập',
  },
  'đồ dã ngoại': {
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80',
    desc: 'Camping & travel gear',
  },
  sách: {
    image: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=800&q=80',
    desc: 'Sách kỹ thuật & phát triển',
  },
}

const FALLBACK = [
  'Điện thoại',
  'Laptop',
  'Phụ kiện',
  'Thời trang nữ',
  'Giày dép',
  'Nhà bếp',
  'Thể thao',
  'Chăm sóc da',
].map((name) => {
  const meta = IMAGE_BY_NAME[name.toLowerCase()]
  return {
    name,
    desc: meta?.desc ?? `Khám phá ${name}`,
    image: meta?.image ?? 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80',
    query: name,
  }
})

const categories = ref(FALLBACK)

onMounted(async () => {
  try {
    const list = await categoryApi.list(true)
    if (!list.length) return
    categories.value = list.map((c) => {
      const meta = IMAGE_BY_NAME[c.name.toLowerCase()]
      return {
        name: c.name,
        desc: meta?.desc ?? `Sản phẩm ${c.name}`,
        image:
          meta?.image ??
          `https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80&sig=${encodeURIComponent(c.slug)}`,
        query: c.name,
      }
    })
  } catch {
    /* giữ fallback */
  }
})

function openCategory(query: string) {
  void router.push({ name: 'search', query: { category: query } })
}
</script>

<template>
  <section class="home-categories" aria-labelledby="home-cat-title">
    <div class="container">
      <div class="home-section-head">
        <div>
          <h2 id="home-cat-title" class="home-section-head__title">Danh mục</h2>
          <p class="home-section-head__sub">Vuốt ngang · bấm để lọc cửa hàng</p>
        </div>
        <button type="button" class="home-section-head__link" @click="router.push('/search')">
          Xem tất cả →
        </button>
      </div>

      <div class="home-categories__rail" role="list">
        <button
          v-for="cat in categories"
          :key="cat.name"
          type="button"
          class="home-cat-chip"
          role="listitem"
          @click="openCategory(cat.query)"
        >
          <img :src="cat.image" :alt="cat.name" loading="lazy" decoding="async" />
          <span class="home-cat-chip__body">
            <strong>{{ cat.name }}</strong>
            <em>{{ cat.desc }}</em>
          </span>
        </button>
      </div>
    </div>
  </section>
</template>
