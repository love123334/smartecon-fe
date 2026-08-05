<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const slides = [
  {
    title: 'Công nghệ đúng gu — mua nhẹ đầu hơn',
    subtitle: 'Catalog thật, giá rõ ràng, hỗ trợ mua sắm nhanh trên SEDSP.',
    image: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=1400&q=70',
    cta: 'Khám phá ngay',
    to: '/search',
  },
  {
    title: 'Ưu đãi đang chạy trong tuần',
    subtitle: 'Tai nghe, laptop và phụ kiện — lọc theo danh mục hoặc ngân sách.',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1400&q=70',
    cta: 'Xem cửa hàng',
    to: '/search?category=Điện+tử',
  },
  {
    title: 'Mua sắm gọn — theo dõi đơn rõ',
    subtitle: 'Giỏ hàng, thanh toán và lịch sử đơn ngay trên một nền tảng.',
    image: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1400&q=70',
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

function goCta() {
  const to = slides[active.value]?.to || '/search'
  void router.push(to)
}

onMounted(() => {
  timer = setInterval(next, 7000)
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
      :style="Math.abs(i - active) <= 1 || i === 0 ? { backgroundImage: `url(${slide.image})` } : undefined"
      aria-hidden="true"
    />

    <div class="home-hero__overlay" aria-hidden="true" />

    <div class="container home-hero__content">
      <Transition name="hero-copy" mode="out-in">
        <div :key="active" class="home-hero__copy">
          <p class="home-hero__brand">SEDSP</p>
          <h1 class="home-hero__title">{{ slides[active].title }}</h1>
          <p class="home-hero__subtitle">{{ slides[active].subtitle }}</p>
          <button type="button" class="home-hero__cta" @click="goCta">
            {{ slides[active].cta }}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </Transition>

      <div class="home-hero__controls">
        <button type="button" class="home-hero__nav" aria-label="Slide trước" @click="prev">
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
        <button type="button" class="home-hero__nav" aria-label="Slide sau" @click="next">
          ›
        </button>
      </div>
    </div>
  </section>
</template>
