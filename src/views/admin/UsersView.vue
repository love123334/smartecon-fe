<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { adminApi } from '@/api/services'
import type { User, UserRole } from '@/types'
import PageHeader from '@/components/PageHeader.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import { listPendingRoleApplications } from '@/utils/roleApplications'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const users = ref<User[]>([])
const pendingApps = ref(0)
const deletingId = ref<string | null>(null)
const loading = ref(true)
const error = ref('')

const currentUserId = computed(() => auth.user?.id ?? '')

async function reloadUsers() {
  error.value = ''
  loading.value = true
  try {
    users.value = await adminApi.listUsers()
    pendingApps.value = listPendingRoleApplications().length
  } catch (e) {
    users.value = []
    error.value = e instanceof Error ? e.message : 'Không tải được danh sách người dùng'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void reloadUsers()
})

async function toggleActive(u: User) {
  error.value = ''
  try {
    await adminApi.setUserActive(u.id, !u.active)
    await reloadUsers()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không cập nhật được trạng thái'
  }
}

async function changeRole(u: User, role: UserRole) {
  error.value = ''
  try {
    await adminApi.setUserRole(u.id, role)
    await reloadUsers()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không đổi được vai trò'
  }
}

async function removeUser(u: User) {
  error.value = ''
  if (u.id === currentUserId.value) {
    error.value = 'Không thể xóa tài khoản admin đang đăng nhập.'
    return
  }
  const ok = window.confirm(
    `Xóa vĩnh viễn tài khoản ${u.fullName} (${u.email})?\n\nHành động này không thể hoàn tác.`,
  )
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

const roleLabel: Record<UserRole, string> = {
  guest: 'Khách',
  customer: 'Khách hàng',
  seller: 'Người bán',
  manager: 'Quản lý',
  admin: 'Admin',
}
</script>

<template>
  <div class="users-page">
    <PageHeader
      eyebrow="Quản trị"
      title="Quản lý người dùng"
      lead="Gán role, khóa/mở hoặc xóa tài khoản. Duyệt hồ sơ xin Seller/Manager từ khách hàng."
    >
      <template #actions>
        <button type="button" class="btn btn-outline btn-sm" :disabled="loading" @click="reloadUsers">
          {{ loading ? 'Đang tải…' : 'Tải lại' }}
        </button>
      </template>
    </PageHeader>

    <p v-if="error" class="alert alert-error" style="margin-bottom: 1rem" role="alert">
      {{ error }}
    </p>

    <p v-if="pendingApps > 0" class="alert alert-success" style="margin-bottom: 1rem">
      Có <strong>{{ pendingApps }}</strong> yêu cầu nâng quyền đang chờ.
      <RouterLink to="/admin/approvals">Duyệt ngay →</RouterLink>
    </p>

    <div class="table-wrap card users-table-card">
      <LoadingSpinner
        v-if="loading"
        page
        label="Đang tải danh sách người dùng hệ thống..."
        sublabel="Đang nạp thông tin tài khoản, vai trò và trạng thái kích hoạt."
      />
      <p v-else-if="!users.length" class="muted users-empty" role="status">
        Chưa có người dùng để hiển thị.
      </p>
      <table v-else class="data users-table">
        <thead>
          <tr>
            <th scope="col">Họ tên</th>
            <th scope="col">Email</th>
            <th scope="col">Vai trò</th>
            <th scope="col">Trạng thái</th>
            <th scope="col">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td class="users-table__name">{{ u.fullName }}</td>
            <td class="users-table__email">{{ u.email }}</td>
            <td>
              <select
                class="users-table__role"
                :value="u.role"
                :aria-label="`Vai trò ${u.email}`"
                @change="changeRole(u, ($event.target as HTMLSelectElement).value as UserRole)"
              >
                <option v-for="r in roles" :key="r" :value="r">{{ roleLabel[r] }}</option>
              </select>
            </td>
            <td>
              <span class="users-status" :class="u.active ? 'users-status--on' : 'users-status--off'">
                {{ u.active ? 'Hoạt động' : 'Khóa' }}
              </span>
            </td>
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
.users-table-card {
  padding: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.users-empty {
  margin: 0;
  padding: 1.25rem 1.1rem;
}

.users-table {
  width: 100%;
  min-width: 640px;
  table-layout: fixed;
  border-collapse: collapse;
}

.users-table th,
.users-table td {
  padding: 0.7rem 0.85rem;
  text-align: left;
  vertical-align: middle;
  border-bottom: 1px solid var(--color-border, #e2e8f0);
  background: transparent;
  user-select: none;
}

.users-table thead th {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--slate-600, #475569);
  background: #f8fafc;
  white-space: nowrap;
}

.users-table th:nth-child(1),
.users-table td:nth-child(1) {
  width: 22%;
}
.users-table th:nth-child(2),
.users-table td:nth-child(2) {
  width: 26%;
}
.users-table th:nth-child(3),
.users-table td:nth-child(3) {
  width: 16%;
}
.users-table th:nth-child(4),
.users-table td:nth-child(4) {
  width: 14%;
}
.users-table th:nth-child(5),
.users-table td:nth-child(5) {
  width: 11rem;
  min-width: 11rem;
}

.users-table__name {
  font-weight: 600;
  word-break: break-word;
}

.users-table__email {
  word-break: break-all;
  font-size: 0.875rem;
  color: var(--slate-700, #334155);
}

.users-table__role {
  max-width: 100%;
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  background: #fff;
  font: inherit;
}

.users-status {
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
}

.users-status--on {
  background: #ecfdf5;
  color: #047857;
}

.users-status--off {
  background: #fef2f2;
  color: #b91c1c;
}

.users-actions {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
}

.users-actions .btn {
  flex: 0 0 auto;
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
