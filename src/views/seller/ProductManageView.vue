<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { productApi, categoryApi, formatVnd } from '@/api/services'
import type { Category } from '@/api/real/categories'
import type { Product } from '@/types'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const products = ref<Product[]>([])
const categories = ref<Category[]>([])
const editing = ref<Product | null>(null)
const showForm = ref(false)
const error = ref('')
const saving = ref(false)
const form = ref({
  name: '',
  description: '',
  price: 0,
  stock: 0,
  categoryId: '',
  imageUrl: 'https://picsum.photos/seed/new/400/300',
})

async function load() {
  if (!auth.user) return
  const sellerKey = auth.user.backendId ?? auth.user.id
  products.value = await productApi.list({ sellerId: sellerKey, withStock: true })
}

onMounted(async () => {
  categories.value = await categoryApi.list()
  await load()
})

function startCreate() {
  editing.value = null
  showForm.value = true
  form.value = {
    name: '',
    description: '',
    price: 0,
    stock: 0,
    categoryId: categories.value[0]?.id ?? '',
    imageUrl: 'https://picsum.photos/seed/new/400/300',
  }
}

function startEdit(p: Product) {
  editing.value = p
  showForm.value = true
  const cat = categories.value.find(
    (c) => c.name.toLowerCase() === p.category.toLowerCase(),
  )
  form.value = {
    name: p.name,
    description: p.description,
    price: p.price,
    stock: p.stock,
    categoryId: cat?.id ?? categories.value[0]?.id ?? '',
    imageUrl: p.imageUrl,
  }
}

async function save() {
  if (!auth.user) return
  if (form.value.price <= 0) {
    error.value = 'Giá sản phẩm phải lớn hơn 0'
    return
  }
  if (!form.value.categoryId) {
    error.value = 'Vui lòng chọn danh mục'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const cat = categories.value.find((c) => c.id === form.value.categoryId)
    if (editing.value) {
      const stockDelta = form.value.stock - editing.value.stock
      await productApi.update(editing.value.id, {
        name: form.value.name,
        description: form.value.description,
        price: form.value.price,
        category: cat?.name ?? editing.value.category,
        categoryId: Number(form.value.categoryId),
        imageUrl: form.value.imageUrl,
        stockDelta,
      })
    } else {
      await productApi.create(auth.user.id, {
        name: form.value.name,
        description: form.value.description,
        price: form.value.price,
        stock: form.value.stock,
        category: cat?.name ?? 'Khác',
        categoryId: Number(form.value.categoryId),
        imageUrl: form.value.imageUrl,
        shopName: auth.user.fullName,
        shopLocation: 'TP.HCM',
      })
    }
    editing.value = null
    showForm.value = false
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không lưu được sản phẩm'
  } finally {
    saving.value = false
  }
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
    <p v-if="error && !showForm" class="elegant-alert elegant-alert--error">{{ error }}</p>
    <form v-if="showForm" class="card form-edit" @submit.prevent="save">
      <h2>{{ editing ? 'Sửa' : 'Thêm' }} sản phẩm</h2>
      <p v-if="error" class="elegant-alert elegant-alert--error">{{ error }}</p>
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
        <select v-model="form.categoryId" required>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <button type="submit" class="btn btn-primary" :disabled="saving">
        {{ saving ? 'Đang lưu...' : 'Lưu' }}
      </button>
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
