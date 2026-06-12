<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const fullName = ref('')
const email = ref('')
const phone = ref('')
const password = ref('')
const confirm = ref('')
const localError = ref('')

async function submit() {
  localError.value = ''
  if (password.value !== confirm.value) {
    localError.value = 'Mật khẩu không khớp'
    return
  }
  try {
    await auth.register({
      email: email.value,
      password: password.value,
      fullName: fullName.value,
      phone: phone.value || undefined,
    })
    router.push('/')
  } catch {
    localError.value = auth.error ?? 'Đăng ký thất bại'
  }
}
</script>

<template>
  <div class="auth-page">
    <h1 class="page-title">Đăng ký</h1>
    <form class="card auth-form" @submit.prevent="submit">
      <p v-if="localError || auth.error" class="alert alert-error">
        {{ localError || auth.error }}
      </p>
      <div class="form-group">
        <label for="name">Họ tên</label>
        <input id="name" v-model="fullName" required />
      </div>
      <div class="form-group">
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" required />
      </div>
      <div class="form-group">
        <label for="phone">Số điện thoại</label>
        <input id="phone" v-model="phone" />
      </div>
      <div class="form-group">
        <label for="pw">Mật khẩu</label>
        <input id="pw" v-model="password" type="password" required minlength="6" />
      </div>
      <div class="form-group">
        <label for="pw2">Xác nhận mật khẩu</label>
        <input id="pw2" v-model="confirm" type="password" required />
      </div>
      <button type="submit" class="btn btn-primary" :disabled="auth.loading">
        Đăng ký
      </button>
      <p>
        Đã có tài khoản?
        <RouterLink to="/login">Đăng nhập</RouterLink>
      </p>
    </form>
  </div>
</template>

<style scoped>
.auth-page {
  max-width: 420px;
  margin: 0 auto;
}
</style>
