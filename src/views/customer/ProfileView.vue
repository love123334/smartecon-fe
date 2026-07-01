<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AvatarPicker from '@/components/AvatarPicker.vue'
import PageHeader from '@/components/PageHeader.vue'

const auth = useAuthStore()
const fullName = ref('')
const phone = ref('')
const address = ref('')
const avatarPreset = ref('default')
const avatarUrl = ref<string | undefined>()
const saved = ref(false)

function syncFromUser() {
  if (!auth.user) return
  fullName.value = auth.user.fullName
  phone.value = auth.user.phone ?? ''
  address.value = auth.user.address ?? ''
  avatarPreset.value = auth.user.avatarPreset ?? 'default'
  avatarUrl.value = auth.user.avatarUrl
}

onMounted(syncFromUser)
watch(() => auth.user, syncFromUser)

function onAvatarChange(data: { avatarPreset?: string; avatarUrl?: string }) {
  if (data.avatarPreset !== undefined) {
    avatarPreset.value = data.avatarPreset
    avatarUrl.value = undefined
  }
  if (data.avatarUrl !== undefined) {
    avatarUrl.value = data.avatarUrl || undefined
    if (data.avatarUrl) avatarPreset.value = 'default'
  }
}

async function save() {
  await auth.updateProfile({
    fullName: fullName.value,
    phone: phone.value,
    address: address.value,
    avatarPreset: avatarUrl.value ? undefined : avatarPreset.value,
    avatarUrl: avatarUrl.value,
  })
  saved.value = true
  setTimeout(() => {
    saved.value = false
  }, 2000)
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Tài khoản"
      title="Hồ sơ cá nhân"
      lead="Quản lý thông tin, địa chỉ giao hàng và ảnh đại diện."
    />

    <form class="card profile-form" @submit.prevent="save">
      <p v-if="saved" class="alert alert-success">Đã lưu thay đổi</p>

      <AvatarPicker
        :name="fullName || auth.user?.fullName || 'Bạn'"
        :avatar-preset="avatarUrl ? undefined : avatarPreset"
        :avatar-url="avatarUrl"
        @change="onAvatarChange"
      />

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

      <div class="profile-form__actions">
        <button type="submit" class="btn btn-primary">Lưu hồ sơ</button>
        <RouterLink to="/recommendations" class="btn btn-outline">
          Xem gợi ý AI →
        </RouterLink>
      </div>
    </form>
  </div>
</template>

<style scoped>
.profile-form {
  max-width: 520px;
}

.profile-form__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
</style>
