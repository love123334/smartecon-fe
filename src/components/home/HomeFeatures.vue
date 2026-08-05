<script setup lang="ts">
const features = [
  {
    title: 'Hỏi nhanh trong chat',
    text: 'Tìm SP, hỏi giá, ngân sách — kéo sản phẩm vào chat để so sánh.',
  },
  {
    title: 'Đơn hàng rõ bước',
    text: 'Theo dõi chờ xác nhận → đang giao → đã giao ngay trên trang đơn.',
  },
  {
    title: 'Giao hàng linh hoạt',
    text: 'Nội thành 1–2 ngày · miễn phí ship đơn từ 500.000₫.',
  },
  {
    title: 'Thanh toán quen thuộc',
    text: 'COD hoặc VNPay — chọn lúc checkout, không cần bước phức tạp.',
  },
]
</script>

<template>
  <section class="home-features" aria-labelledby="home-features-title">
    <div class="container">
      <div class="home-section-head home-section-head--center">
        <div>
          <h2 id="home-features-title" class="home-section-head__title">Mua trên SEDSP</h2>
          <p class="home-section-head__sub">Ít bước hơn · rõ thông tin hơn</p>
        </div>
      </div>
      <div class="home-features__grid">
        <article v-for="(f, i) in features" :key="f.title" class="home-feature">
          <span class="home-feature__num" aria-hidden="true">{{ String(i + 1).padStart(2, '0') }}</span>
          <h3>{{ f.title }}</h3>
          <p>{{ f.text }}</p>
        </article>
      </div>
    </div>
  </section>
</template>
