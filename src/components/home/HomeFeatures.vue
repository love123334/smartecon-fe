<script setup lang="ts">
const features = [
  {
    title: 'Trợ lý mua sắm',
    text: 'Hỏi đáp nhanh, gợi ý sản phẩm phù hợp nhu cầu và ngân sách.',
    paths: [
      'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    ],
  },
  {
    title: 'DSS quyết định',
    text: 'Hỗ trợ người bán tối ưu tồn kho, giá và chiến lược kinh doanh.',
    paths: [
      'M3 3v18h18',
      'M7 14l4-4 4 3 5-6',
    ],
  },
  {
    title: 'Giao hàng nhanh',
    text: 'Miễn phí vận chuyển đơn từ 500K — theo dõi đơn theo thời gian thực.',
    paths: [
      'M1 3h15v13H1z',
      'M16 8h4l3 5v5h-7V8z',
      'M5.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
      'M18.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
    ],
  },
  {
    title: 'Thanh toán an toàn',
    text: 'COD, ví điện tử và bảo mật phiên đăng nhập khi kết nối hệ thống.',
    paths: [
      'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    ],
  },
]
</script>

<template>
  <section class="home-features" aria-labelledby="home-features-title">
    <div class="container">
      <h2 id="home-features-title" class="sr-only">Tính năng SEDSP</h2>
      <div class="home-features__grid">
        <article
          v-for="(f, i) in features"
          :key="f.title"
          class="home-feature reveal-up"
          :style="{ '--delay': `${i * 0.08}s` }"
        >
          <span class="home-feature__icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path v-for="(d, pi) in f.paths" :key="pi" :d="d" />
            </svg>
          </span>
          <h3>{{ f.title }}</h3>
          <p>{{ f.text }}</p>
        </article>
      </div>
    </div>
  </section>
</template>
