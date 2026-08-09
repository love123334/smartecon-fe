<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { iconForCategoryName, useCategoryStore } from '@/stores/categories'

const router = useRouter()
const cats = useCategoryStore()

/** Ảnh/desc trang trí theo từ khóa — danh sách tên vẫn lấy từ API. */
const META_BY_KEYWORD: { test: RegExp; image: string; desc: string }[] = [
  {
    test: /điện thoại|phone|smartphone/i,
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80',
    desc: 'Smartphone & phụ kiện',
  },
  {
    test: /máy tính xách tay|laptop|notebook/i,
    image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80',
    desc: 'Máy tính xách tay học tập & làm việc',
  },
  {
    test: /máy tính bảng|tablet|ipad/i,
    image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&q=80',
    desc: 'Tablet & bút cảm ứng',
  },
  {
    test: /phụ kiện|tai nghe|accessory/i,
    image: 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=800&q=80',
    desc: 'Cáp, ốp, tai nghe',
  },
  {
    test: /thời trang nữ|women/i,
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80',
    desc: 'Đầm, áo, phụ kiện nữ',
  },
  {
    test: /thời trang nam|men/i,
    image: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800&q=80',
    desc: 'Áo thun, sơ mi, basics',
  },
  {
    test: /thời trang|fashion/i,
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80',
    desc: 'Phong cách hàng ngày',
  },
  {
    test: /giày|sneaker/i,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
    desc: 'Sneaker & giày thể thao',
  },
  {
    test: /chăm sóc da|skincare/i,
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80',
    desc: 'Chăm sóc da hàng ngày',
  },
  {
    test: /làm đẹp|makeup|trang điểm/i,
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80',
    desc: 'Chăm sóc & làm đẹp',
  },
  {
    test: /nhà bếp|kitchen/i,
    image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80',
    desc: 'Nồi, chảo, thiết bị bếp',
  },
  {
    test: /gia dụng|nhà cửa/i,
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80',
    desc: 'Đồ dùng nhà cửa',
  },
  {
    test: /thể thao|sport/i,
    image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80',
    desc: 'Tập luyện & ngoài trời',
  },
  {
    test: /đồ dã ngoại|outdoor|camping/i,
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80',
    desc: 'Đồ cắm trại & du lịch',
  },
  {
    test: /điện tử|electronic|dss|demo/i,
    image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80',
    desc: 'Thiết bị & phụ kiện số',
  },
]

function metaFor(name: string) {
  const hit = META_BY_KEYWORD.find((m) => m.test.test(name))
  return {
    desc: hit?.desc ?? `Sản phẩm ${name}`,
    image:
      hit?.image ??
      `https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80&sig=${encodeURIComponent(name)}`,
  }
}

const display = computed(() =>
  cats.items.map((c) => {
    const meta = metaFor(c.name)
    return {
      id: c.id,
      name: c.name,
      query: c.name,
      desc: meta.desc,
      image: meta.image,
      icon: iconForCategoryName(c.name),
    }
  }),
)

onMounted(() => {
  void cats.load()
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

      <p v-if="cats.loading && !display.length" class="muted home-categories__status">Đang tải danh mục…</p>
      <p v-else-if="cats.error && !display.length" class="muted home-categories__status">
        {{ cats.error }}
      </p>
      <p v-else-if="!display.length" class="muted home-categories__status">Chưa có danh mục từ hệ thống.</p>

      <div v-else class="home-categories__rail" role="list">
        <button
          v-for="cat in display"
          :key="cat.id"
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

<style scoped>
.home-categories__status {
  margin: 0.5rem 0 0;
  font-size: 0.9rem;
}
</style>
