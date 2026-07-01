<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { isChatPage, roleChatPath } from '@/utils/roleAiNav'
import { isShopBrowsePath } from '@/utils/roleNav'

const route = useRoute()
const auth = useAuthStore()

const showFab = computed(() => {
  if (isChatPage(route.path)) return false
  if (['/login', '/register'].includes(route.path)) return false

  if (!auth.isLoggedIn) {
    return ['/', '/search', '/products'].some(
      (p) => route.path === p || route.path.startsWith(`${p}/`),
    )
  }

  if (auth.role === 'customer' || auth.role === 'guest') {
    return (
      isShopBrowsePath(route.path) ||
      route.path === '/recommendations' ||
      route.path === '/chatbot'
    )
  }

  // seller / manager / admin — FAB trên mọi trang ops & shop (trừ chat)
  return true
})

const to = computed(() => {
  if (!auth.isLoggedIn) {
    return { path: '/login', query: { redirect: '/chatbot' } }
  }
  return roleChatPath(auth.role)
})
</script>

<template>
  <RouterLink
    v-if="showFab"
    :to="to"
    class="chat-fab btn-interactive"
    title="Trợ lý AI"
    aria-label="Mở trợ lý AI"
  >
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
    <span class="chat-fab__label">AI</span>
  </RouterLink>
</template>

<style scoped>
.chat-fab {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  z-index: 120;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.75rem 1rem;
  border-radius: 999px;
  background: #000;
  color: #fff;
  text-decoration: none;
  font-size: 0.8125rem;
  font-weight: 700;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
  transition: transform var(--transition), box-shadow var(--transition);
}

.chat-fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
  color: #fff;
  text-decoration: none;
}

.chat-fab__label {
  letter-spacing: 0.04em;
}

@media (max-width: 640px) {
  .chat-fab__label {
    display: none;
  }
  .chat-fab {
    padding: 0.85rem;
    border-radius: 50%;
  }
}
</style>
