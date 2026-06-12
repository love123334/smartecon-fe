<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import SearchBar from '@/components/SearchBar.vue'
import CategoryNav from '@/components/CategoryNav.vue'

const auth = useAuthStore()
const cart = useCartStore()
const router = useRouter()
const route = useRoute()
const menuOpen = ref(false)

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

async function onLogout() {
  await auth.logout()
  cart.lines = []
  menuOpen.value = false
  router.push('/login')
}

function closeMenu() {
  menuOpen.value = false
}
</script>

<template>
  <!-- Marketplace header (guest + customer + shop browsing) -->
  <template v-if="isShopMode">
    <div class="mkt-topbar">
      <div class="container mkt-topbar__inner">
        <div class="mkt-topbar__links">
          <RouterLink to="/seller/products">Kênh Người Bán</RouterLink>
          <RouterLink to="/manager/dashboard">Quản lý DSS</RouterLink>
          <span class="mkt-topbar__badge">🧠 Tích hợp AI + Decision Support</span>
        </div>
        <div class="mkt-topbar__links">
          <template v-if="auth.user">
            <span>Xin chào, {{ auth.user.fullName }}</span>
            <button type="button" class="btn-ghost btn-sm" style="color: #fff; border: none; padding: 0" @click="onLogout">
              Đăng xuất
            </button>
          </template>
          <template v-else>
            <RouterLink to="/register">Đăng ký</RouterLink>
            <RouterLink to="/login">Đăng nhập</RouterLink>
          </template>
        </div>
      </div>
    </div>

    <header class="mkt-header">
      <div class="container mkt-header__inner">
        <RouterLink to="/" class="mkt-brand" @click="closeMenu">
          <span class="mkt-brand__icon">S</span>
          <span class="mkt-brand__text">
            <strong>SEDSP</strong>
            <small>Decision Support</small>
          </span>
        </RouterLink>

        <SearchBar />

        <div class="mkt-header__actions">
          <template v-if="auth.role === 'customer'">
            <RouterLink to="/orders" class="mkt-cart-btn" title="Đơn hàng">
              <span class="mkt-cart-btn__icon">📦</span>
              <span>Đơn hàng</span>
            </RouterLink>
            <RouterLink to="/cart" class="mkt-cart-btn" title="Giỏ hàng">
              <span class="mkt-cart-btn__icon">🛒</span>
              <span>Giỏ hàng</span>
              <span v-if="cart.itemCount" class="mkt-cart-btn__badge">{{ cart.itemCount }}</span>
            </RouterLink>
            <RouterLink to="/chatbot" class="mkt-cart-btn" title="Trợ lý AI">
              <span class="mkt-cart-btn__icon">💬</span>
              <span>Trợ lý</span>
            </RouterLink>
          </template>
          <template v-else-if="!auth.user">
            <RouterLink to="/login" class="mkt-cart-btn">
              <span class="mkt-cart-btn__icon">🛒</span>
              <span>Giỏ hàng</span>
            </RouterLink>
          </template>
          <span v-if="auth.user" class="badge badge-role">{{ roleLabels[auth.role] }}</span>
        </div>
      </div>
    </header>

    <CategoryNav />
  </template>

  <!-- Ops header (seller / manager / admin) -->
  <header v-else class="ops-header">
    <div class="container ops-header__inner">
      <RouterLink to="/" class="mkt-brand">
        <span class="mkt-brand__icon">S</span>
        <span class="mkt-brand__text">
          <strong>SEDSP</strong>
          <small>{{ roleLabels[auth.role] }} Portal</small>
        </span>
      </RouterLink>

      <nav class="nav" style="flex: 1">
        <RouterLink v-for="link in opsNavLinks" :key="link.to" :to="link.to" class="nav-link">
          {{ link.label }}
        </RouterLink>
        <RouterLink to="/" class="nav-link">← Cửa hàng</RouterLink>
      </nav>

      <div class="mkt-user-menu" style="color: var(--slate-700)">
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
  background: var(--primary-50);
  color: var(--primary-800);
  text-decoration: none;
}

.nav-link.router-link-active {
  background: var(--primary-100);
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
