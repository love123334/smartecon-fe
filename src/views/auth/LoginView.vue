<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { DEMO_PASSWORD } from '@/api/mockData'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const cart = useCartStore()
const email = ref('')
const password = ref('')
const localError = ref('')

const demos = [
  { label: 'Customer', email: 'customer@sedsp.vn', desc: 'Mua sắm, giỏ hàng' },
  { label: 'Seller', email: 'seller@sedsp.vn', desc: 'Quản lý & DSS' },
  { label: 'Manager', email: 'manager@sedsp.vn', desc: 'Analytics' },
  { label: 'Admin', email: 'admin@sedsp.vn', desc: 'Hệ thống' },
]

function fillDemo(e: string) {
  email.value = e
  password.value = DEMO_PASSWORD
}

async function submit() {
  localError.value = ''
  try {
    await auth.login(email.value, password.value)
    if (auth.role === 'customer') await cart.refresh()
    const redirect = (route.query.redirect as string) || undefined
    if (redirect) router.push(redirect)
    else if (auth.role === 'seller') router.push('/seller/products')
    else if (auth.role === 'manager') router.push('/manager/dashboard')
    else if (auth.role === 'admin') router.push('/admin/users')
    else router.push('/')
  } catch {
    localError.value = auth.error ?? 'Đăng nhập thất bại'
  }
}
</script>

<template>
  <div class="auth-layout">
    <aside class="auth-panel-brand">
      <p class="brand-tag">SEDSP Platform</p>
      <h1>Đăng nhập để tiếp tục</h1>
      <p>
        Hệ thố hỗ trợ quyết định kinh doanh tích hợp AI — kết nối backend Spring Boot khi
        API sẵn sàng.
      </p>
      <ul class="features">
        <li>JWT & phân quyền RBAC</li>
        <li>DSS: dự báo, gợi ý giá & tồn kho</li>
        <li>Chatbot tư vấn khách hàng & seller</li>
      </ul>
    </aside>

    <section class="auth-panel-form">
      <div class="auth-form-box">
        <h2 class="page-title" style="font-size: 1.35rem">Chào mừng trở lại</h2>
        <p class="page-lead" style="margin-bottom: 1.25rem">Nhập email và mật khẩu tài khoản của bạn.</p>

        <div class="border-glow">
          <form class="border-glow__inner card--flat" style="padding: 1.25rem 1.5rem" @submit.prevent="submit">
          <p v-if="localError || auth.error" class="alert alert-error alert--animate">
            {{ localError || auth.error }}
          </p>
          <div class="form-group">
            <label for="email">Email</label>
            <input id="email" v-model="email" type="email" required autocomplete="email" class="input-glow" />
          </div>
          <div class="form-group">
            <label for="pw">Mật khẩu</label>
            <input id="pw" v-model="password" type="password" required autocomplete="current-password" class="input-glow" />
          </div>
          <button type="submit" class="btn btn-primary btn-block btn-glow" :disabled="auth.loading">
            {{ auth.loading ? 'Đang xử lý...' : 'Đăng nhập' }}
          </button>
          <p class="muted" style="margin: 1rem 0 0; text-align: center">
            Chưa có tài khoản?
            <RouterLink to="/register">Đăng ký ngay</RouterLink>
          </p>
          </form>
        </div>

        <div class="card demo-box card--flat" style="margin-top: 1.25rem">
          <p class="card-title" style="margin-bottom: 0.5rem">Tài khoản demo</p>
          <p class="muted" style="margin: 0 0 0.75rem">Mật khẩu: <code>123456</code></p>
          <div class="demo-grid">
            <button
              v-for="d in demos"
              :key="d.email"
              type="button"
              class="demo-chip btn-interactive"
              @click="fillDemo(d.email)"
            >
              <strong>{{ d.label }}</strong>
              <span>{{ d.desc }}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.brand-tag {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.85;
  margin: 0 0 1rem;
}

.auth-panel-brand h1 {
  margin: 0 0 0.75rem;
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.auth-panel-brand > p {
  margin: 0 0 1.5rem;
  opacity: 0.9;
  max-width: 36ch;
}

.features {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.9rem;
  opacity: 0.95;
}

.features li::before {
  content: '✓ ';
  font-weight: 700;
}

.demo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.demo-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  padding: 0.65rem 0.75rem;
  text-align: left;
  background: var(--slate-50);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  cursor: pointer;
  font-family: inherit;
  transition: border-color var(--transition), background var(--transition);
}

.demo-chip:hover {
  border-color: var(--primary-500);
  background: var(--primary-50);
}

.demo-chip strong {
  font-size: 0.8125rem;
  color: var(--slate-800);
}

.demo-chip span {
  font-size: 0.7rem;
  color: var(--slate-500);
}
</style>
