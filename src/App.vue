<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'

const auth = useAuthStore()
const cart = useCartStore()
const route = useRoute()

const fullBleed = computed(() => Boolean(route.meta.fullBleed))

const isShopPage = computed(() => {
  const shopPrefixes = ['/', '/search', '/products', '/cart', '/checkout', '/orders', '/recommendations', '/chatbot', '/profile']
  return shopPrefixes.some((p) => route.path === p || (p !== '/' && route.path.startsWith(p)))
})

onMounted(async () => {
  await auth.hydrate()
  if (auth.role === 'customer') {
    await cart.refresh()
  }
})
</script>

<template>
  <AppHeader />
  <main class="page" :class="{ 'page--bleed': fullBleed, 'page--shop': isShopPage && !fullBleed }">
    <div :class="fullBleed ? 'page-bleed-wrap' : 'container'">
      <RouterView v-slot="{ Component }">
        <Transition name="page-fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </div>
  </main>
  <footer class="footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <strong>SEDSP</strong>
        <span>Smart E-Commerce Decision Support Platform</span>
      </div>
      <div class="footer-meta">
        <span>SU26JS01 · GSU26JS02</span>
        <span>© 2026 FPT University</span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.page--bleed {
  padding: 0;
}

.page-bleed-wrap {
  width: 100%;
  max-width: none;
  padding: 0;
}

.footer {
  margin-top: auto;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
  padding: 1.5rem 0;
}

.footer-inner {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.footer-brand {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.footer-brand strong {
  font-size: 0.9375rem;
  color: var(--slate-900);
}

.footer-brand span {
  font-size: 0.8125rem;
  color: var(--slate-500);
}

.footer-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.15rem;
  font-size: 0.75rem;
  color: var(--slate-400);
}
</style>
