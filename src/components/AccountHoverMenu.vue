<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { roleAccountMenuLinks } from '@/utils/roleAiNav'
import UserAvatar from '@/components/UserAvatar.vue'

const props = withDefaults(
  defineProps<{
    variant?: 'shop' | 'ops'
  }>(),
  { variant: 'shop' },
)

const auth = useAuthStore()
const cart = useCartStore()
const router = useRouter()
const open = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | null = null

const roleLabels: Record<string, string> = {
  customer: 'Khách hàng',
  seller: 'Người bán',
  manager: 'Quản lý',
  admin: 'Admin',
}

const greeting = computed(() => {
  const name = auth.user?.fullName?.split(' ').pop() ?? 'bạn'
  return `Xin chào, ${name}!`
})

const menuLinks = computed(() => {
  if (!auth.user) return []
  return roleAccountMenuLinks(auth.role)
})

function onEnter() {
  if (closeTimer) clearTimeout(closeTimer)
  open.value = true
}

function onLeave() {
  closeTimer = setTimeout(() => {
    open.value = false
  }, 120)
}

async function logout() {
  await auth.logout()
  cart.lines = []
  router.push('/login')
}
</script>

<template>
  <div class="account-menu-root">
    <div
      v-if="auth.user"
      class="account-menu"
      @mouseenter="onEnter"
      @mouseleave="onLeave"
    >
      <button
        type="button"
        class="account-menu__trigger shop-icon-btn btn-interactive"
        :class="{ 'account-menu__trigger--open': open }"
        aria-haspopup="true"
        :aria-expanded="open"
        aria-label="Tài khoản"
      >
        <UserAvatar
          :name="auth.user.fullName"
          :avatar-preset="auth.user.avatarPreset"
          :avatar-url="auth.user.avatarUrl"
          size="sm"
        />
      </button>

      <Transition name="account-pop">
        <div v-if="open" class="account-menu__panel" role="menu">
          <div class="account-menu__head">
            <UserAvatar
              :name="auth.user.fullName"
              :avatar-preset="auth.user.avatarPreset"
              :avatar-url="auth.user.avatarUrl"
              size="md"
            />
            <div class="account-menu__meta">
              <strong>{{ greeting }}</strong>
              <span class="account-menu__role">{{ roleLabels[auth.role] ?? auth.role }}</span>
              <span class="account-menu__email">{{ auth.user.email }}</span>
            </div>
          </div>

          <nav v-if="menuLinks.length" class="account-menu__links">
            <RouterLink
              v-for="link in menuLinks"
              :key="link.to"
              :to="link.to"
              class="account-menu__link"
              :class="{ 'account-menu__link--ai': link.highlight }"
              role="menuitem"
              @click="open = false"
            >
              {{ link.label }}
            </RouterLink>
          </nav>

          <button type="button" class="account-menu__logout" role="menuitem" @click="logout">
            Đăng xuất
          </button>
        </div>
      </Transition>
    </div>

    <RouterLink
      v-else
      to="/login"
      class="shop-icon-btn btn-interactive"
      title="Đăng nhập"
      aria-label="Đăng nhập"
    >
      <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    </RouterLink>
  </div>
</template>

<style scoped>
.account-menu-root {
  display: inline-flex;
  align-items: center;
}

.account-menu {
  position: relative;
}

.account-menu__trigger {
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.account-menu__trigger--open {
  background: var(--slate-100);
}

.account-menu__panel {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  z-index: 200;
  min-width: 240px;
  padding: 0.75rem;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.12);
}

.account-menu__head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding-bottom: 0.65rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

.account-menu__meta {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.account-menu__meta strong {
  font-size: 0.875rem;
  color: var(--slate-900);
}

.account-menu__role {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--primary-700);
}

.account-menu__email {
  font-size: 0.6875rem;
  color: var(--slate-500);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-menu__links {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.account-menu__link {
  display: block;
  padding: 0.5rem 0.65rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--slate-700);
  text-decoration: none;
  border-radius: var(--radius);
  transition: background var(--transition), color var(--transition);
}

.account-menu__link:hover {
  background: var(--slate-50);
  color: var(--slate-900);
  text-decoration: none;
}

.account-menu__link--ai {
  color: #0f766e;
  background: #ecfdf5;
}

.account-menu__link--ai:hover {
  background: #d1fae5;
  color: #065f46;
}

.account-menu__logout {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.5rem 0.65rem;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--slate-500);
  text-align: left;
  cursor: pointer;
  transition: background var(--transition), color var(--transition);
}

.account-menu__logout:hover {
  background: #fef2f2;
  color: #b91c1c;
}

.account-pop-enter-active,
.account-pop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.account-pop-enter-from,
.account-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
