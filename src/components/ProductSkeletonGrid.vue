<script setup lang="ts">
withDefaults(
  defineProps<{
    count?: number
  }>(),
  { count: 4 },
)
</script>

<template>
  <div class="product-skel-grid" aria-hidden="true">
    <div v-for="n in count" :key="n" class="product-skel">
      <div class="product-skel__media" />
      <div class="product-skel__line product-skel__line--sm" />
      <div class="product-skel__line" />
      <div class="product-skel__line product-skel__line--price" />
    </div>
  </div>
</template>

<style scoped>
.product-skel-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1.25rem;
}

.product-skel__media {
  aspect-ratio: 1;
  border-radius: var(--radius, 8px);
  background: linear-gradient(90deg, #eef1f4 25%, #f7f8fa 50%, #eef1f4 75%);
  background-size: 200% 100%;
  animation: product-skel-shine 1.1s ease-in-out infinite;
  margin-bottom: 0.75rem;
}

.product-skel__line {
  height: 0.75rem;
  border-radius: 4px;
  background: #e8ecf0;
  margin-bottom: 0.45rem;
}

.product-skel__line--sm {
  width: 40%;
  height: 0.55rem;
}

.product-skel__line--price {
  width: 55%;
  height: 0.9rem;
}

@keyframes product-skel-shine {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

@media (max-width: 960px) {
  .product-skel-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .product-skel-grid {
    grid-template-columns: 1fr;
  }
}
</style>
