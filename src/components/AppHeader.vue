<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'

const auth = useAuthStore()
const cart = useCartStore()
const router = useRouter()
const route = useRoute()
const promoDismissed = ref(false)

const isShopMode = computed(() => {
  if (auth.role === 'guest' || auth.role === 'customer') return true
  const shopPaths = ['/', '/search', '/products', '/cart', '/checkout', '/orders', '/recommendations', '/chatbot', '/profile', '/register', '/login']
  return shopPaths.some((p) => route.path === p || route.path.startsWith(p + '/'))
})

const roleLabels: Record<string, string> = {
  guest: 'Khách',
  customer: 'Khách hàng',
  seller: 'Người bán',
  manager: 'Quản lý',
  admin: 'Admin',
}

const opsNavLinks = computed(() => {
  const r = auth.role
  if (r === 'seller') {
    return [
      { to: '/seller/products', label: 'Sản phẩm' },
      { to: '/seller/inventory', label: 'Tồn kho' },
      { to: '/seller/sales', label: 'Doanh số' },
      { to: '/seller/dss', label: 'DSS' },
      { to: '/seller/chatbot', label: 'Trợ lý AI' },
    ]
  }
  if (r === 'manager') {
    return [
      { to: '/manager/dashboard', label: 'Dashboard' },
      { to: '/manager/analytics', label: 'Phân tích' },
      { to: '/manager/dss', label: 'DSS' },
    ]
  }
  if (r === 'admin') {
    return [
      { to: '/admin/users', label: 'Người dùng' },
      { to: '/admin/monitoring', label: 'Giám sát' },
    ]
  }
  return []
})

const profileTo = computed(() => {
  if (!auth.user) return '/login'
  if (auth.role === 'customer') return '/profile'
  return '/'
})

function onOpenCart() {
  cart.openDrawer()
}

async function onLogout() {
  await auth.logout()
  cart.lines = []
  router.push('/login')
}
</script>

<template>
  <template v-if="isShopMode">
    <div v-if="!promoDismissed" class="shop-promo-bar">
      <div class="container shop-promo-bar__inner">
        <p>
          Giảm 30% toàn shop — Có hạn!
          <RouterLink to="/search" class="shop-promo-bar__link">Mua ngay →</RouterLink>
        </p>
        <button type="button" class="shop-promo-bar__close" aria-label="Đóng thông báo" @click="promoDismissed = true">
          ×
        </button>
      </div>
    </div>

    <header class="shop-header">
      <div class="container shop-header__inner">
        <RouterLink to="/" class="shop-brand">
          SEDSP<span class="shop-brand__dot">.</span>
        </RouterLink>

        <nav class="shop-nav" aria-label="Điều hướng chính">
          <RouterLink to="/" class="shop-nav__link" exact-active-class="shop-nav__link--active">Trang chủ</RouterLink>
          <RouterLink to="/search" class="shop-nav__link" active-class="shop-nav__link--active">Cửa hàng</RouterLink>
          <RouterLink to="/chatbot" class="shop-nav__link">Liên hệ</RouterLink>
        </nav>

        <div class="shop-header__actions">
          <RouterLink to="/search" class="shop-icon-btn btn-interactive" title="Tìm kiếm" aria-label="Tìm kiếm">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </RouterLink>
          <RouterLink :to="profileTo" class="shop-icon-btn btn-interactive" title="Tài khoản" aria-label="Tài khoản">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </RouterLink>
          <button
            type="button"
            class="shop-icon-btn shop-icon-btn--cart btn-interactive"
            title="Giỏ hàng"
            aria-label="Giỏ hàng"
            @click="onOpenCart"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <span v-if="cart.itemCount" class="shop-icon-btn__badge">{{ cart.itemCount }}</span>
          </button>
          <button
            v-if="auth.user"
            type="button"
            class="shop-header__logout btn-interactive"
            @click="onLogout"
          >
            Thoát
          </button>
        </div>
      </div>
    </header>
  </template>

  <header v-else class="ops-header">
    <div class="container ops-header__inner">
      <RouterLink to="/" class="shop-brand shop-brand--sm">
        SEDSP<span class="shop-brand__dot">.</span>
      </RouterLink>

      <nav class="nav" style="flex: 1">
        <RouterLink v-for="link in opsNavLinks" :key="link.to" :to="link.to" class="nav-link nav-link--slide">
          {{ link.label }}
        </RouterLink>
        <RouterLink to="/" class="nav-link">← Cửa hàng</RouterLink>
      </nav>

      <div class="mkt-user-menu" style="color: var(--slate-700)">
        <span class="badge badge-role">{{ roleLabels[auth.role] }}</span>
        <span class="user-name">{{ auth.user?.fullName }}</span>
        <button type="button" class="btn btn-ghost btn-sm" @click="onLogout">Đăng xuất</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.15rem 0.25rem;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  padding: 0.45rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--slate-600);
  border-radius: var(--radius);
  text-decoration: none;
  transition: background var(--transition), color var(--transition);
}

.nav-link:hover {
  background: var(--slate-100);
  color: var(--slate-900);
  text-decoration: none;
}

.nav-link.router-link-active {
  background: var(--primary-50);
  color: var(--primary-800);
}

.user-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--slate-700);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .nav {
    display: none;
  }
}
</style>
