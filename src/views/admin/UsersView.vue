<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { adminApi } from '@/api/services'
import type { User, UserRole } from '@/types'
import PageHeader from '@/components/PageHeader.vue'
import { listPendingRoleApplications } from '@/utils/roleApplications'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const users = ref<User[]>([])
const pendingApps = ref(0)
const deletingId = ref<string | null>(null)
const error = ref('')

const currentUserId = computed(() => auth.user?.id ?? '')

onMounted(async () => {
  users.value = await adminApi.listUsers()
  pendingApps.value = listPendingRoleApplications().length
})

async function reloadUsers() {
  users.value = await adminApi.listUsers()
}

async function toggleActive(u: User) {
  error.value = ''
  await adminApi.setUserActive(u.id, !u.active)
  await reloadUsers()
}

async function changeRole(u: User, role: UserRole) {
  error.value = ''
  await adminApi.setUserRole(u.id, role)
  await reloadUsers()
}

async function removeUser(u: User) {
  error.value = ''
  if (u.id === currentUserId.value) {
    error.value = 'Không thể xóa tài khoản admin đang đăng nhập.'
    return
  }
  const ok = window.confirm(`Xóa vĩnh viễn tài khoản ${u.fullName} (${u.email})?\n\nHành động này không thể hoàn tác.`)
  if (!ok) return

  deletingId.value = u.id
  try {
    await adminApi.deleteUser(u.id)
    await reloadUsers()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không xóa được tài khoản'
  } finally {
    deletingId.value = null
  }
}

const roles: UserRole[] = ['customer', 'seller', 'manager', 'admin']
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Quản trị"
      title="Quản lý người dùng"
      lead="Gán role, khóa/mở hoặc xóa tài khoản. Duyệt hồ sơ xin Seller/Manager từ khách hàng."
    />

    <p v-if="error" class="alert alert-error" style="margin-bottom: 1rem">{{ error }}</p>

    <p v-if="pendingApps > 0" class="alert alert-success" style="margin-bottom: 1rem">
      Có <strong>{{ pendingApps }}</strong> yêu cầu nâng quyền đang chờ.
      <RouterLink to="/admin/approvals">Duyệt ngay →</RouterLink>
    </p>

    <div class="table-wrap card">
      <table class="data">
        <thead>
          <tr>
            <th>Họ tên</th>
            <th>Email</th>
            <th>Vai trò</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>{{ u.fullName }}</td>
            <td>{{ u.email }}</td>
            <td>
              <select
                :value="u.role"
                @change="changeRole(u, ($event.target as HTMLSelectElement).value as UserRole)"
              >
                <option v-for="r in roles" :key="r" :value="r">{{ r }}</option>
              </select>
            </td>
            <td>{{ u.active ? 'Hoạt động' : 'Khóa' }}</td>
            <td class="users-actions">
              <button type="button" class="btn btn-outline btn-sm" @click="toggleActive(u)">
                {{ u.active ? 'Khóa' : 'Mở' }}
              </button>
              <button
                type="button"
                class="btn btn-outline btn-sm users-actions__delete"
                :disabled="u.id === currentUserId || deletingId === u.id"
                @click="removeUser(u)"
              >
                {{ deletingId === u.id ? 'Đang xóa…' : 'Xóa' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.users-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  white-space: nowrap;
}

.users-actions__delete {
  color: #b91c1c;
  border-color: #fecaca;
}

.users-actions__delete:hover:not(:disabled) {
  background: #fef2f2;
  border-color: #f87171;
}

.users-actions__delete:disabled {
  opacity: 0.45;
}
</style>
