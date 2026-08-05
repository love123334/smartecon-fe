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

.product-skel {
  animation: rise-in 0.4s ease backwards;
}

.product-skel:nth-child(1) { animation-delay: 0.02s; }
.product-skel:nth-child(2) { animation-delay: 0.06s; }
.product-skel:nth-child(3) { animation-delay: 0.1s; }
.product-skel:nth-child(4) { animation-delay: 0.14s; }
.product-skel:nth-child(n + 5) { animation-delay: 0.18s; }

.product-skel__media {
  aspect-ratio: 1;
  border-radius: var(--radius, 8px);
  background: linear-gradient(105deg, #e8ecf2 20%, #f6f8fb 45%, #e8ecf2 70%);
  background-size: 220% 100%;
  animation: product-skel-shine 1.25s ease-in-out infinite;
  margin-bottom: 0.75rem;
}

.product-skel__line {
  height: 0.75rem;
  border-radius: 4px;
  background: linear-gradient(105deg, #e4e9f0 20%, #f3f5f8 50%, #e4e9f0 80%);
  background-size: 220% 100%;
  animation: product-skel-shine 1.25s ease-in-out infinite;
  margin-bottom: 0.45rem;
}

.product-skel__line--sm {
  width: 40%;
  height: 0.55rem;
  animation-delay: 0.08s;
}

.product-skel__line--price {
  width: 55%;
  height: 0.9rem;
  animation-delay: 0.12s;
}

@keyframes product-skel-shine {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
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
