<script setup lang="ts">
defineProps<{
  title?: string
  subtitle?: string
  breadcrumb?: { label: string; to?: string }[]
}>()
</script>

<template>
  <section class="shop-hero" aria-label="Tiêu đề trang">
    <div class="shop-hero__bg" aria-hidden="true" />
    <div class="container shop-hero__inner">
      <nav v-if="breadcrumb?.length" class="shop-hero__crumb" aria-label="Breadcrumb">
        <template v-for="(item, i) in breadcrumb" :key="i">
          <span v-if="i > 0" class="shop-hero__crumb-sep" aria-hidden="true">›</span>
          <RouterLink v-if="item.to" :to="item.to">{{ item.label }}</RouterLink>
          <span v-else>{{ item.label }}</span>
        </template>
      </nav>
      <h1 class="shop-hero__title">{{ title ?? 'Cửa hàng' }}</h1>
      <p v-if="subtitle" class="shop-hero__subtitle">{{ subtitle }}</p>
    </div>
  </section>
</template>
