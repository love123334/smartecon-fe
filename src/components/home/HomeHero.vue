<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const slides = [
  {
    title: 'Công nghệ đúng gu — mua nhẹ đầu hơn',
    subtitle: 'Gợi ý thông minh từ DSS & trợ lý AI. Khám phá hàng nghìn sản phẩm tech chính hãng.',
    image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1600&q=80',
    cta: 'Khám phá ngay',
    to: '/search',
  },
  {
    title: 'Flash sale — Giảm đến 50%',
    subtitle: 'Ưu đãi có hạn trên tai nghe, bàn phím và phụ kiện gaming.',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1600&q=80',
    cta: 'Xem deal hot',
    to: '/search?category=Điện+tử',
  },
  {
    title: 'Simply Unique / Simply Better',
    subtitle: 'Thiết kế tối giản, trải nghiệm mua sắm tinh gọn — kiểu 3legant.',
    image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1600&q=80',
    cta: 'Vào cửa hàng',
    to: '/search',
  },
]

const active = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

function goTo(i: number) {
  active.value = (i + slides.length) % slides.length
}

function next() {
  goTo(active.value + 1)
}

function prev() {
  goTo(active.value - 1)
}

onMounted(() => {
  timer = setInterval(next, 6000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <section class="home-hero" aria-label="Banner trang chủ">
    <div
      v-for="(slide, i) in slides"
      :key="i"
      class="home-hero__slide"
      :class="{ 'home-hero__slide--active': i === active }"
      :style="{ backgroundImage: `url(${slide.image})` }"
      aria-hidden="true"
    />

    <div class="home-hero__overlay" aria-hidden="true" />

    <div class="container home-hero__content">
      <Transition name="hero-copy" mode="out-in">
        <div :key="active" class="home-hero__copy">
          <p class="home-hero__eyebrow">SEDSP · Smart Commerce</p>
          <h1 class="home-hero__title">{{ slides[active].title }}</h1>
          <p class="home-hero__subtitle">{{ slides[active].subtitle }}</p>
          <RouterLink :to="slides[active].to" class="home-hero__cta btn-interactive">
            {{ slides[active].cta }}
            <span aria-hidden="true">→</span>
          </RouterLink>
        </div>
      </Transition>

      <div class="home-hero__controls">
        <button type="button" class="home-hero__nav btn-interactive" aria-label="Slide trước" @click="prev">
          ‹
        </button>
        <div class="home-hero__dots" role="tablist" aria-label="Chọn slide">
          <button
            v-for="(_, i) in slides"
            :key="i"
            type="button"
            class="home-hero__dot"
            :class="{ 'home-hero__dot--active': i === active }"
            :aria-selected="i === active"
            :aria-label="`Slide ${i + 1}`"
            @click="goTo(i)"
          />
        </div>
        <button type="button" class="home-hero__nav btn-interactive" aria-label="Slide sau" @click="next">
          ›
        </button>
      </div>
    </div>
  </section>
</template>
