<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import CartFlyout from '@/components/CartFlyout.vue'
import ChatSupportFab from '@/components/ChatSupportFab.vue'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { footerLinksForRole } from '@/utils/roleNav'
import { roleAiFooterLinks } from '@/utils/roleAiNav'

const auth = useAuthStore()
const cart = useCartStore()
const route = useRoute()

const footerLinks = computed(() => [
  ...footerLinksForRole(auth.role),
  ...roleAiFooterLinks(auth.role),
])

const fullBleed = computed(() => Boolean(route.meta.fullBleed))

const shopWide = computed(() => ['/', '/search'].includes(route.path))

const isHomePage = computed(() => route.path === '/')
const isShopCatalog = computed(() => route.path === '/search')

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
  <CartFlyout />
  <ChatSupportFab />
  <main
    class="page"
    :class="{
      'page--bleed': fullBleed,
      'page--shop': isShopPage && !fullBleed,
      'page--shop-wide': shopWide && !fullBleed,
      'page--home': isHomePage,
      'page--catalog': isShopCatalog,
    }"
  >
    <div v-if="shopWide || fullBleed" class="page-bleed-wrap">
      <RouterView v-slot="{ Component }">
        <Transition name="page-fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </div>
    <div v-else :class="fullBleed ? 'page-bleed-wrap' : 'container'">
      <RouterView v-slot="{ Component }">
        <Transition name="page-fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </div>
  </main>
  <footer class="footer footer--animate footer--elegant">
    <div class="container footer-elegant__top">
      <div class="footer-elegant__brand">
        <strong>SEDSP<span class="shop-brand__dot">.</span></strong>
        <span class="footer-elegant__tag">Chợ tech · Gợi ý thông minh DSS & AI</span>
      </div>
      <nav class="footer-elegant__nav" aria-label="Footer">
        <RouterLink v-for="link in footerLinks" :key="link.to" :to="link.to">
          {{ link.label }}
        </RouterLink>
      </nav>
    </div>
    <div class="container footer-elegant__bottom">
      <span>© 2026 SEDSP · FPT University</span>
      <div class="footer-elegant__legal">
        <a href="#">Chính sách bảo mật</a>
        <a href="#">Điều khoản</a>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.page--bleed {
  padding: 0;
}

.page--shop-wide {
  padding: 0;
}

.page-bleed-wrap {
  width: 100%;
  max-width: none;
  padding: 0;
}

.footer {
  margin-top: auto;
  border-top: none;
  background: #000;
  color: rgba(255, 255, 255, 0.55);
  padding: 2rem 0 1.5rem;
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
  gap: 0.35rem;
}

.footer-brand strong {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.03em;
  text-transform: uppercase;
}

.footer-brand span {
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.45);
  max-width: 28ch;
  line-height: 1.55;
}

.footer-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.2rem;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.35);
}
</style>
