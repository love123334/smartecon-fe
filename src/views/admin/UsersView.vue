<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { adminApi } from '@/api/services'
import type { User, UserRole } from '@/types'

const users = ref<User[]>([])

onMounted(async () => {
  users.value = await adminApi.listUsers()
})

async function toggleActive(u: User) {
  await adminApi.setUserActive(u.id, !u.active)
  users.value = await adminApi.listUsers()
}

async function changeRole(u: User, role: UserRole) {
  await adminApi.setUserRole(u.id, role)
  users.value = await adminApi.listUsers()
}

const roles: UserRole[] = ['customer', 'seller', 'manager', 'admin']
</script>

<template>
  <div>
    <h1 class="page-title">Quản lý người dùng</h1>
    <div class="table-wrap card">
      <table class="data">
        <thead>
          <tr>
            <th>Họ tên</th>
            <th>Email</th>
            <th>Vai trò</th>
            <th>Trạng thái</th>
            <th></th>
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
            <td>
              <button type="button" class="btn btn-outline btn-sm" @click="toggleActive(u)">
                {{ u.active ? 'Khóa' : 'Mở' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
