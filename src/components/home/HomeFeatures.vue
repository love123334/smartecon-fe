<script setup lang="ts">
const features = [
  {
    icon: '🤖',
    title: 'Trợ lý AI',
    text: 'Hỏi đáp, gợi ý sản phẩm phù hợp nhu cầu và ngân sách của bạn.',
  },
  {
    icon: '📊',
    title: 'DSS thông minh',
    text: 'Hỗ trợ người bán tối ưu tồn kho, giá và chiến lược kinh doanh.',
  },
  {
    icon: '⚡',
    title: 'Giao nhanh',
    text: 'Miễn phí vận chuyển đơn từ 500K — theo dõi đơn realtime.',
  },
  {
    icon: '🔒',
    title: 'Thanh toán an toàn',
    text: 'COD, chuyển khoản và bảo mật JWT khi kết nối backend.',
  },
]
</script>

<template>
  <section class="home-features" aria-labelledby="home-features-title">
    <div class="container">
      <h2 id="home-features-title" class="sr-only">Tính năng SEDSP</h2>
      <div class="home-features__grid">
        <article v-for="(f, i) in features" :key="f.title" class="home-feature reveal-up" :style="{ '--delay': `${i * 0.08}s` }">
          <span class="home-feature__icon" aria-hidden="true">{{ f.icon }}</span>
          <h3>{{ f.title }}</h3>
          <p>{{ f.text }}</p>
        </article>
      </div>
    </div>
  </section>
</template>
