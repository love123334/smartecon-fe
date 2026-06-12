<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { productApi, formatVnd } from '@/api/services'
import type { Product } from '@/types'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const products = ref<Product[]>([])
const editing = ref<Product | null>(null)
const showForm = ref(false)
const form = ref({
  name: '',
  description: '',
  price: 0,
  stock: 0,
  category: '',
  imageUrl: 'https://picsum.photos/seed/new/400/300',
})

async function load() {
  if (!auth.user) return
  products.value = await productApi.list({ sellerId: auth.user.id })
}

onMounted(load)

function startCreate() {
  editing.value = null
  showForm.value = true
  form.value = {
    name: '',
    description: '',
    price: 0,
    stock: 0,
    category: 'Điện tử',
    imageUrl: 'https://picsum.photos/seed/new/400/300',
  }
}

function startEdit(p: Product) {
  editing.value = p
  showForm.value = true
  form.value = {
    name: p.name,
    description: p.description,
    price: p.price,
    stock: p.stock,
    category: p.category,
    imageUrl: p.imageUrl,
  }
}

async function save() {
  if (!auth.user) return
  if (editing.value) {
    await productApi.update(editing.value.id, { ...form.value })
  } else {
    await productApi.create(auth.user.id, form.value)
  }
  editing.value = null
  showForm.value = false
  await load()
}

async function remove(id: string) {
  if (confirm('Xóa sản phẩm?')) {
    await productApi.remove(id)
    await load()
  }
}
</script>

<template>
  <div>
    <h1 class="page-title">Quản lý sản phẩm</h1>
    <button type="button" class="btn btn-primary" @click="startCreate">+ Thêm SP</button>
    <form v-if="showForm" class="card form-edit" @submit.prevent="save">
      <h2>{{ editing ? 'Sửa' : 'Thêm' }} sản phẩm</h2>
      <div class="form-group">
        <label>Tên</label>
        <input v-model="form.name" required />
      </div>
      <div class="form-group">
        <label>Mô tả</label>
        <textarea v-model="form.description" rows="2" required />
      </div>
      <div class="form-group">
        <label>Giá (VND)</label>
        <input v-model.number="form.price" type="number" min="0" required />
      </div>
      <div class="form-group">
        <label>Tồn kho</label>
        <input v-model.number="form.stock" type="number" min="0" required />
      </div>
      <div class="form-group">
        <label>Danh mục</label>
        <input v-model="form.category" required />
      </div>
      <button type="submit" class="btn btn-primary">Lưu</button>
    </form>
    <div class="table-wrap card" style="margin-top: 1rem">
      <table class="data">
        <thead>
          <tr>
            <th>Tên</th>
            <th>Giá</th>
            <th>Tồn</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in products" :key="p.id">
            <td>{{ p.name }}</td>
            <td>{{ formatVnd(p.price) }}</td>
            <td>{{ p.stock }}</td>
            <td>
              <button type="button" class="btn btn-outline btn-sm" @click="startEdit(p)">
                Sửa
              </button>
              <button type="button" class="btn btn-danger btn-sm" @click="remove(p.id)">
                Xóa
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.form-edit {
  margin-top: 1rem;
  max-width: 520px;
}
.form-edit h2 {
  margin-top: 0;
  font-size: 1.1rem;
}
</style>
