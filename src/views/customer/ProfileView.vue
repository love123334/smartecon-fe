<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const fullName = ref('')
const phone = ref('')
const address = ref('')
const saved = ref(false)

onMounted(() => {
  if (auth.user) {
    fullName.value = auth.user.fullName
    phone.value = auth.user.phone ?? ''
    address.value = auth.user.address ?? ''
  }
})

async function save() {
  await auth.updateProfile({
    fullName: fullName.value,
    phone: phone.value,
    address: address.value,
  })
  saved.value = true
  setTimeout(() => {
    saved.value = false
  }, 2000)
}
</script>

<template>
  <div>
    <h1 class="page-title">Hồ sơ</h1>
    <form class="card" style="max-width: 480px" @submit.prevent="save">
      <p v-if="saved" class="alert alert-success">Đã lưu thay đổi</p>
      <div class="form-group">
        <label>Email</label>
        <input :value="auth.user?.email" disabled />
      </div>
      <div class="form-group">
        <label for="name">Họ tên</label>
        <input id="name" v-model="fullName" required />
      </div>
      <div class="form-group">
        <label for="phone">Số điện thoại</label>
        <input id="phone" v-model="phone" />
      </div>
      <div class="form-group">
        <label for="addr">Địa chỉ giao hàng</label>
        <textarea id="addr" v-model="address" rows="3" />
      </div>
      <button type="submit" class="btn btn-primary">Lưu</button>
    </form>
  </div>
</template>
